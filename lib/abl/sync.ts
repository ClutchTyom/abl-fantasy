import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { ablGet, ABL_DIVISIONS } from "@/lib/abl/client";
import {
  AblGame,
  AblGameUser,
  AblRosterEntry,
  AblTournament,
  AblTournamentTeam,
  AblUserStatistic,
} from "@/lib/abl/types";
import { Player } from "@/types/player";

const ABL_LEAGUE_ID = 2;
const BASE_PRICE = 8;

// Сколько запросов к ABL держим в полёте одновременно при загрузке
// составов команд / статистики матчей — это единственная часть синка,
// которую нельзя "объединить" в один запрос (у ABL нет bulk-эндпоинтов),
// поэтому хотя бы распараллеливаем в разумных пределах, не долбя их
// сервер полностью без ограничений.
const ABL_FETCH_CONCURRENCY = 6;
// Сколько строк уходит в одном bulk-запросе к нашей БД.
const DB_CHUNK_SIZE = 500;

const POSITION_MAP: Record<string, Player["position"]> = {
  point_guard: "PG",
  shooting_guard: "SG",
  small_forward: "SF",
  power_forward: "PF",
  center: "C",
};

function mapPosition(raw: string | null | undefined): Player["position"] {
  return POSITION_MAP[raw ?? ""] ?? "SF";
}

function mapMatchStatus(raw: string): string {
  if (raw === "closed") return "finished";
  if (raw.includes("live") || raw === "in_progress") return "live";
  return "scheduled";
}

function computeRoundStatus(matchStatuses: string[]): string {
  if (matchStatuses.length === 0) return "upcoming";
  if (matchStatuses.every((s) => s === "finished")) return "completed";
  if (matchStatuses.some((s) => s === "finished" || s === "live")) return "live";
  return "upcoming";
}

function roundKeyAndName(game: AblGame): { key: string; name: string } | null {
  if (game.tournament_tour != null) {
    return { key: `tour:${game.tournament_tour}`, name: `Тур ${game.tournament_tour}` };
  }
  if (game.playoff_round != null) {
    const stage = game.playoff_stage?.trim();
    return {
      key: `playoff:${game.playoff_round}`,
      name: stage ? `Плей-офф ${stage}` : `Плей-офф раунд ${game.playoff_round}`,
    };
  }
  return null;
}

function generateShortName(name: string, taken: Set<string>): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let base =
    words.length > 1
      ? words
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 4)
      : name
          .replace(/[^A-Za-zА-Яа-яЁё]/g, "")
          .slice(0, 4)
          .toUpperCase();

  if (!base) base = "TM";

  let candidate = base;
  let i = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${i}`;
    i++;
  }
  taken.add(candidate);
  return candidate;
}

// Параллельно выполняет asyncFn для каждого элемента items, но не больше
// concurrency штук одновременно — компромисс между "всё по очереди"
// (медленно) и "всё разом" (можем захлебнуть сторонний сервер).
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  asyncFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await asyncFn(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function bulkUpsertRpc(
  client: SupabaseClient,
  fnName: "bulk_upsert_teams" | "bulk_upsert_players",
  rows: Record<string, unknown>[]
): Promise<{ id: string; abl_id: string }[]> {
  const results: { id: string; abl_id: string }[] = [];

  for (let i = 0; i < rows.length; i += DB_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DB_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const { data, error } = await client.rpc(fnName, { rows: chunk });

    if (error) {
      throw new Error(`Не удалось сохранить (${fnName}): ${error.message}`);
    }

    results.push(...((data as { id: string; abl_id: string }[] | null) ?? []));
  }

  return results;
}

async function bulkUpsertTable(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<{ id: string; abl_id?: string }[]> {
  const results: { id: string; abl_id?: string }[] = [];

  for (let i = 0; i < rows.length; i += DB_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DB_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const { data, error } = await client
      .from(table)
      .upsert(chunk, { onConflict })
      .select();

    if (error) {
      throw new Error(`Не удалось сохранить (${table}): ${error.message}`);
    }

    results.push(...((data as { id: string; abl_id?: string }[] | null) ?? []));
  }

  return results;
}

export type SyncSummary = {
  teams: number;
  players: number;
  rounds: number;
  matches: number;
  stats: number;
  warnings: string[];
};

export async function syncAblTournament(
  alias: string,
  onProgress?: (message: string) => void,
  client: SupabaseClient = browserSupabase
): Promise<SyncSummary> {
  const log = (message: string) => onProgress?.(message);
  const warnings: string[] = [];

  log(`Загружаю дивизион "${alias}"...`);
  const tournament = await ablGet<AblTournament>(
    `/league/${ABL_LEAGUE_ID}/tournaments/${alias}/`
  );

  log("Загружаю команды...");
  const ablTeams = await ablGet<AblTournamentTeam[]>(
    `/tournament/${tournament.id}/teams/`
  );

  // abl_id + short_name уже существующих команд — короткие имена НОВЫХ
  // команд генерируем не пересекаясь ни с чужими, ни с уже занятыми;
  // короткое имя УЖЕ существующей команды просто передаём обратно как
  // есть (SQL-функция его всё равно не тронет при конфликте, но
  // Postgres должен получить непустое уникальное значение на попытку
  // INSERT ещё до разрешения конфликта).
  const { data: existingTeams } = await client
    .from("teams")
    .select("abl_id, short_name")
    .not("abl_id", "is", null);

  const shortNameByAblId = new Map(
    (existingTeams ?? []).map((t) => [t.abl_id as string, t.short_name as string])
  );
  const shortNameTaken = new Set(
    (existingTeams ?? []).map((t) => t.short_name as string)
  );

  const teamRows = ablTeams.map((ablTeam) => {
    const ablId = `team:${ablTeam.team.id}`;
    const shortName =
      shortNameByAblId.get(ablId) ?? generateShortName(ablTeam.team.name, shortNameTaken);

    return {
      abl_id: ablId,
      name: ablTeam.team.name,
      short_name: shortName,
      division: tournament.name,
      logo_url: ablTeam.team.logo?.path ?? null,
    };
  });

  const upsertedTeams = await bulkUpsertRpc(client, "bulk_upsert_teams", teamRows);
  const teamIdByAblId = new Map(upsertedTeams.map((t) => [t.abl_id, t.id]));
  const teamsCount = upsertedTeams.length;

  log(`Команды готовы: ${teamsCount}. Загружаю составы...`);

  const rosters = await mapWithConcurrency(ablTeams, ABL_FETCH_CONCURRENCY, (ablTeam) =>
    ablGet<AblRosterEntry[]>(`/tournament_team/${ablTeam.id}/users/`)
  );

  const playerRows: Record<string, unknown>[] = [];

  ablTeams.forEach((ablTeam, index) => {
    const teamId = teamIdByAblId.get(`team:${ablTeam.team.id}`);
    if (!teamId) {
      warnings.push(`Пропущена команда "${ablTeam.team.name}": не удалось сохранить`);
      return;
    }

    for (const entry of rosters[index]) {
      const user = entry.team_user.user;
      const fullName = `${user.last_name ?? ""} ${user.first_name ?? ""}`.trim();

      if (!fullName) {
        warnings.push(`Пропущен игрок без имени (user id ${user.id})`);
        continue;
      }

      // Ключ игрока — team_user.id (регистрация ЧЕЛОВЕКА В КОНКРЕТНОЙ
      // команде), а не user.id (сам человек). В ABL один и тот же человек
      // может официально играть за несколько команд одновременно — при
      // ключе по user.id повторная синхронизация другой команды просто
      // перевешивала бы team_id, и человек пропадал из состава первой
      // команды. team_user.id это разруливает: игрок на двух командах —
      // две отдельные карточки, каждая копит статистику только за матчи
      // именно этой команды (см. привязку статистики ниже, тем же ключом).
      playerRows.push({
        abl_id: `player:${entry.team_user.id}`,
        full_name: fullName,
        position: mapPosition(user.basketball_profile?.position),
        team_id: teamId,
        price: BASE_PRICE,
        photo_url: user.photo?.path ?? null,
      });
    }
  });

  const upsertedPlayers = await bulkUpsertRpc(client, "bulk_upsert_players", playerRows);
  const playerIdByAblId = new Map(upsertedPlayers.map((p) => [p.abl_id, p.id]));
  const playersCount = upsertedPlayers.length;

  log(`Игроки готовы: ${playersCount}. Загружаю календарь...`);
  const games = await ablGet<AblGame[]>(`/tournament/${tournament.id}/games/`);

  const datedGames = games.filter((g) => {
    if (!g.datetime) return false;
    if (!g.team_id || !g.competitor_team_id) return false;
    return roundKeyAndName(g) !== null;
  });

  const roundGroups = new Map<string, AblGame[]>();
  for (const game of datedGames) {
    const { key } = roundKeyAndName(game)!;
    const list = roundGroups.get(key) ?? [];
    list.push(game);
    roundGroups.set(key, list);
  }

  const roundRows = Array.from(roundGroups.entries()).map(([key, groupGames]) => {
    const { name } = roundKeyAndName(groupGames[0])!;
    const lockAt = groupGames.map((g) => g.datetime!).sort()[0];
    const status = computeRoundStatus(groupGames.map((g) => mapMatchStatus(g.status)));

    return {
      abl_id: `${tournament.id}:${key}`,
      // Название дивизиона впереди — иначе в админке при 13 дивизионах
      // "Тур 1" от каждого не отличить друг от друга.
      name: `${tournament.name} — ${name}`,
      status,
      lock_at: lockAt,
    };
  });

  const upsertedRounds = await bulkUpsertTable(client, "rounds", roundRows, "abl_id");
  const roundIdByAblId = new Map(
    upsertedRounds.map((r) => [r.abl_id as string, r.id])
  );
  const roundsCount = upsertedRounds.length;

  log(`Туры готовы: ${roundsCount}. Загружаю матчи...`);

  const matchRows: Record<string, unknown>[] = [];

  for (const game of datedGames) {
    const { key } = roundKeyAndName(game)!;
    const roundId = roundIdByAblId.get(`${tournament.id}:${key}`);
    const homeTeamId = teamIdByAblId.get(`team:${game.team_id}`);
    const awayTeamId = teamIdByAblId.get(`team:${game.competitor_team_id}`);

    if (!roundId || !homeTeamId || !awayTeamId) {
      warnings.push(`Пропущен матч ${game.id}: не найдены тур или команды`);
      continue;
    }

    matchRows.push({
      abl_id: String(game.id),
      round_id: roundId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      starts_at: game.datetime,
      status: mapMatchStatus(game.status),
    });
  }

  const upsertedMatches = await bulkUpsertTable(client, "matches", matchRows, "abl_id");
  const matchIdByAblGameId = new Map(
    upsertedMatches.map((m) => [m.abl_id as string, m.id])
  );
  const matchesCount = upsertedMatches.length;

  const finishedGames = datedGames.filter(
    (g) => g.status === "closed" && matchIdByAblGameId.has(String(g.id))
  );

  log(
    `Матчи готовы: ${matchesCount}. Загружаю статистику (${finishedGames.length} сыгранных матчей)...`
  );

  const gameStatsPairs = await mapWithConcurrency(
    finishedGames,
    ABL_FETCH_CONCURRENCY,
    async (game) => {
      const [gameUsers, stats] = await Promise.all([
        ablGet<AblGameUser[]>(`/tournament_game/${game.id}/users/`),
        ablGet<AblUserStatistic[]>(
          `/tournament_basketball_game/${game.id}/user_statistic/`
        ),
      ]);
      return { game, gameUsers, stats };
    }
  );

  const statRows: Record<string, unknown>[] = [];

  for (const { game, gameUsers, stats } of gameStatsPairs) {
    const matchId = matchIdByAblGameId.get(String(game.id))!;

    // team_user.id (не user.id) — тот же ключ, что и у самого игрока выше,
    // чтобы статистика попала на карточку именно той команды, за которую
    // сыгран конкретный матч, если человек играет за несколько команд.
    const teamUserIdByGameUserId = new Map<number, number>();
    gameUsers.forEach((gu) => {
      teamUserIdByGameUserId.set(gu.id, gu.team_user.id);
    });

    for (const stat of stats) {
      const teamUserId = teamUserIdByGameUserId.get(stat.game_user_id);
      const playerId = teamUserId
        ? playerIdByAblId.get(`player:${teamUserId}`)
        : undefined;

      if (!playerId) {
        warnings.push(
          `Матч ${game.id}: не найден игрок для game_user_id ${stat.game_user_id}`
        );
        continue;
      }

      statRows.push({
        match_id: matchId,
        player_id: playerId,
        two_pt_made: stat.two_points_made,
        two_pt_miss: stat.two_point_attempts - stat.two_points_made,
        three_pt_made: stat.three_points_made,
        three_pt_miss: stat.three_point_attempts - stat.three_points_made,
        ft_made: stat.free_throws_made,
        ft_miss: stat.free_throw_attempts - stat.free_throws_made,
        rebounds: stat.rebounds,
        assists: stat.assists,
        steals: stat.steals,
        blocks: stat.blocks,
        turnovers: stat.turnovers,
      });
    }
  }

  log(`Сохраняю статистику (${statRows.length} записей)...`);
  const upsertedStats = await bulkUpsertTable(
    client,
    "player_match_stats",
    statRows,
    "match_id,player_id"
  );
  const statsCount = upsertedStats.length;

  log("Готово.");

  const { error: syncLogError } = await client.from("sync_runs").insert({
    division_alias: alias,
    division_label: ABL_DIVISIONS.find((d) => d.alias === alias)?.label ?? alias,
    teams: teamsCount,
    players: playersCount,
    rounds: roundsCount,
    matches: matchesCount,
    stats: statsCount,
    warnings: warnings.length,
  });

  if (syncLogError) {
    warnings.push(`Не удалось записать лог синхронизации: ${syncLogError.message}`);
  }

  return {
    teams: teamsCount,
    players: playersCount,
    rounds: roundsCount,
    matches: matchesCount,
    stats: statsCount,
    warnings,
  };
}
