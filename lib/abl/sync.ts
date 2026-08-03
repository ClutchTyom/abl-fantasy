import { supabase } from "@/lib/supabaseClient";
import { ablGet } from "@/lib/abl/client";
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

export type SyncSummary = {
  teams: number;
  players: number;
  rounds: number;
  matches: number;
  stats: number;
  warnings: string[];
};

async function upsertTeam(
  ablTeamId: number,
  name: string,
  shortNameTaken: Set<string>
): Promise<string> {
  const ablId = `team:${ablTeamId}`;

  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("abl_id", ablId)
    .maybeSingle();

  if (existing) {
    await supabase.from("teams").update({ name }).eq("id", existing.id);
    return existing.id;
  }

  const shortName = generateShortName(name, shortNameTaken);
  const { data: inserted, error } = await supabase
    .from("teams")
    .insert({ name, short_name: shortName, abl_id: ablId })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Не удалось создать команду "${name}": ${error?.message}`);
  }

  return inserted.id;
}

async function upsertPlayer(
  ablUserId: number,
  fullName: string,
  position: Player["position"],
  teamId: string,
  photoUrl: string | null
): Promise<string> {
  const ablId = `player:${ablUserId}`;

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("abl_id", ablId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("players")
      .update({ full_name: fullName, position, team_id: teamId, photo_url: photoUrl })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("players")
    .insert({
      full_name: fullName,
      position,
      team_id: teamId,
      price: BASE_PRICE,
      photo_url: photoUrl,
      abl_id: ablId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Не удалось создать игрока "${fullName}": ${error?.message}`);
  }

  return inserted.id;
}

async function upsertRound(
  ablId: string,
  name: string,
  status: string,
  lockAt: string
): Promise<string> {
  const { data, error } = await supabase
    .from("rounds")
    .upsert({ abl_id: ablId, name, status, lock_at: lockAt }, { onConflict: "abl_id" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Не удалось создать тур "${name}": ${error?.message}`);
  }

  return data.id;
}

async function upsertMatch(
  ablId: string,
  roundId: string,
  homeTeamId: string,
  awayTeamId: string,
  startsAt: string,
  status: string
): Promise<string> {
  const { data, error } = await supabase
    .from("matches")
    .upsert(
      {
        abl_id: ablId,
        round_id: roundId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        starts_at: startsAt,
        status,
      },
      { onConflict: "abl_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Не удалось создать матч: ${error?.message}`);
  }

  return data.id;
}

export async function syncAblTournament(
  alias: string,
  onProgress?: (message: string) => void
): Promise<SyncSummary> {
  const log = (message: string) => onProgress?.(message);
  const warnings: string[] = [];

  log(`Загружаю дивизион "${alias}"...`);
  const tournament = await ablGet<AblTournament>(
    `/league/${ABL_LEAGUE_ID}/tournaments/${alias}/`
  );

  const { data: existingShortNames } = await supabase.from("teams").select("short_name");
  const shortNameTaken = new Set(
    (existingShortNames ?? []).map((t) => t.short_name as string)
  );

  log("Загружаю команды...");
  const ablTeams = await ablGet<AblTournamentTeam[]>(
    `/tournament/${tournament.id}/teams/`
  );

  const teamIdByAblId = new Map<number, string>();
  let teamsCount = 0;

  for (const ablTeam of ablTeams) {
    const teamId = await upsertTeam(ablTeam.team.id, ablTeam.team.name, shortNameTaken);
    teamIdByAblId.set(ablTeam.team.id, teamId);
    teamsCount++;
  }

  log(`Команды готовы: ${teamsCount}. Загружаю составы...`);
  const playerIdByAblUserId = new Map<number, string>();
  let playersCount = 0;

  for (const ablTeam of ablTeams) {
    const teamId = teamIdByAblId.get(ablTeam.team.id)!;
    const roster = await ablGet<AblRosterEntry[]>(
      `/tournament_team/${ablTeam.id}/users/`
    );

    for (const entry of roster) {
      const user = entry.team_user.user;
      const fullName = `${user.last_name ?? ""} ${user.first_name ?? ""}`.trim();

      if (!fullName) {
        warnings.push(`Пропущен игрок без имени (user id ${user.id})`);
        continue;
      }

      const playerId = await upsertPlayer(
        user.id,
        fullName,
        mapPosition(user.basketball_profile?.position),
        teamId,
        user.photo?.path ?? null
      );

      playerIdByAblUserId.set(user.id, playerId);
      playersCount++;
    }
  }

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

  let roundsCount = 0;
  const roundIdByKey = new Map<string, string>();

  for (const [key, groupGames] of roundGroups) {
    const { name } = roundKeyAndName(groupGames[0])!;
    const lockAt = groupGames
      .map((g) => g.datetime!)
      .sort()[0];
    const status = computeRoundStatus(groupGames.map((g) => mapMatchStatus(g.status)));

    const roundId = await upsertRound(`${tournament.id}:${key}`, name, status, lockAt);
    roundIdByKey.set(key, roundId);
    roundsCount++;
  }

  log(`Туры готовы: ${roundsCount}. Загружаю матчи...`);
  let matchesCount = 0;
  const finishedMatches: { matchId: string; ablGameId: number }[] = [];

  for (const game of datedGames) {
    const { key } = roundKeyAndName(game)!;
    const roundId = roundIdByKey.get(key);
    const homeTeamId = teamIdByAblId.get(game.team_id!);
    const awayTeamId = teamIdByAblId.get(game.competitor_team_id!);

    if (!roundId || !homeTeamId || !awayTeamId) {
      warnings.push(`Пропущен матч ${game.id}: не найдены тур или команды`);
      continue;
    }

    const status = mapMatchStatus(game.status);
    const matchId = await upsertMatch(
      String(game.id),
      roundId,
      homeTeamId,
      awayTeamId,
      game.datetime!,
      status
    );
    matchesCount++;

    if (game.status === "closed") {
      finishedMatches.push({ matchId, ablGameId: game.id });
    }
  }

  log(`Матчи готовы: ${matchesCount}. Загружаю статистику (${finishedMatches.length} сыгранных матчей)...`);
  let statsCount = 0;

  for (const { matchId, ablGameId } of finishedMatches) {
    const [gameUsers, stats] = await Promise.all([
      ablGet<AblGameUser[]>(`/tournament_game/${ablGameId}/users/`),
      ablGet<AblUserStatistic[]>(`/tournament_basketball_game/${ablGameId}/user_statistic/`),
    ]);

    const playerAblUserIdByGameUserId = new Map<number, number>();
    gameUsers.forEach((gu) => {
      playerAblUserIdByGameUserId.set(gu.id, gu.team_user.user.id);
    });

    for (const stat of stats) {
      const ablUserId = playerAblUserIdByGameUserId.get(stat.game_user_id);
      const playerId = ablUserId ? playerIdByAblUserId.get(ablUserId) : undefined;

      if (!playerId) {
        warnings.push(
          `Матч ${ablGameId}: не найден игрок для game_user_id ${stat.game_user_id}`
        );
        continue;
      }

      const { error } = await supabase.from("player_match_stats").upsert(
        {
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
        },
        { onConflict: "match_id,player_id" }
      );

      if (error) {
        warnings.push(`Матч ${ablGameId}: ошибка сохранения статистики — ${error.message}`);
        continue;
      }

      statsCount++;
    }
  }

  log("Готово.");

  return {
    teams: teamsCount,
    players: playersCount,
    rounds: roundsCount,
    matches: matchesCount,
    stats: statsCount,
    warnings,
  };
}
