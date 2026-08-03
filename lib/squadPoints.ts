import { supabase } from "@/lib/supabaseClient";
import { calculateFantasyPoints } from "@/lib/fantasyPoints";
import { fetchAllRows } from "@/lib/fetchAll";
import { StatLine } from "@/types/playerMatchStats";

export type SquadPlayerResult = {
  playerId: string;
  fullName: string;
  isCaptain: boolean;
  points: number;
};

export type SquadResult = {
  squadId: string;
  userId: string;
  weekId: string;
  weekStartsAt: string;
  weekEndsAt: string;
  totalPoints: number;
  players: SquadPlayerResult[];
};

type SquadRow = {
  id: string;
  user_id: string;
  round_id: string;
  fantasy_weeks: { starts_at: string; ends_at: string } | null;
};

// Очки всех сохранённых составов по фэнтези-неделям, которые уже начались
// (starts_at <= сейчас) — используется и для личных результатов на "Моя
// команда", и для общего рейтинга. Очки игрока за неделю = сумма фэнтези-
// очков по ВСЕМ его матчам (любого дивизиона ABL), попавшим в диапазон
// [starts_at, ends_at) этой недели — не только "его" дивизиона, раз все
// дивизионы играют по одним и тем же выходным.
//
// Никаких embed-джойнов через select("players(...)") — эта связь не
// резолвится (у fantasy_squad_players нет нужного foreign key для
// автосвязи), поэтому игроки собираются отдельным запросом и объединяются
// на клиенте.
export async function computeAllSquadResults(): Promise<SquadResult[]> {
  const { data: squads } = await supabase
    .from("fantasy_squads")
    .select("id, user_id, round_id, fantasy_weeks(starts_at, ends_at)");

  const now = Date.now();

  const relevantSquads = ((squads ?? []) as unknown as SquadRow[]).filter(
    (s) => s.fantasy_weeks && new Date(s.fantasy_weeks.starts_at).getTime() <= now
  );

  if (relevantSquads.length === 0) return [];

  const squadIds = relevantSquads.map((s) => s.id);

  const { data: squadPlayers } = await supabase
    .from("fantasy_squad_players")
    .select("squad_id, player_id, is_captain")
    .in("squad_id", squadIds);

  const playerIds = Array.from(
    new Set((squadPlayers ?? []).map((row) => row.player_id))
  );

  const { data: playersData } = playerIds.length
    ? await supabase.from("players").select("id, full_name").in("id", playerIds)
    : { data: [] };

  const playerNameById = new Map(
    ((playersData ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ])
  );

  // Уникальные недели среди relevantSquads (много пользователей могут
  // ссылаться на одну и ту же неделю).
  const weeksById = new Map<string, { starts_at: string; ends_at: string }>();
  relevantSquads.forEach((s) => {
    if (s.fantasy_weeks) weeksById.set(s.round_id, s.fantasy_weeks);
  });
  const uniqueWeeks = Array.from(weeksById.values());

  const overallStart = uniqueWeeks.reduce(
    (min, w) => (w.starts_at < min ? w.starts_at : min),
    uniqueWeeks[0].starts_at
  );
  const overallEnd = uniqueWeeks.reduce(
    (max, w) => (w.ends_at > max ? w.ends_at : max),
    uniqueWeeks[0].ends_at
  );

  const matches = await fetchAllRows<{ id: string; starts_at: string }>((from, to) =>
    supabase
      .from("matches")
      .select("id, starts_at")
      .gte("starts_at", overallStart)
      .lt("starts_at", overallEnd)
      .range(from, to)
  );

  const matchIds = matches.map((m) => m.id);

  const statsRows = matchIds.length
    ? await fetchAllRows<{ match_id: string; player_id: string } & StatLine>((from, to) =>
        supabase.from("player_match_stats").select("*").in("match_id", matchIds).range(from, to)
      )
    : [];

  function weekIdForMatch(matchStartsAtMs: number): string | null {
    for (const [weekId, w] of weeksById) {
      if (
        matchStartsAtMs >= new Date(w.starts_at).getTime() &&
        matchStartsAtMs < new Date(w.ends_at).getTime()
      ) {
        return weekId;
      }
    }
    return null;
  }

  const matchToWeek = new Map<string, string>();
  matches.forEach((m) => {
    const weekId = weekIdForMatch(new Date(m.starts_at).getTime());
    if (weekId) matchToWeek.set(m.id, weekId);
  });

  // очки игрока за неделю = сумма фэнтези-очков по всем его матчам на этой неделе
  const pointsByWeekAndPlayer = new Map<string, number>();

  statsRows.forEach((row) => {
    const weekId = matchToWeek.get(row.match_id);
    if (!weekId) return;

    const key = `${weekId}:${row.player_id}`;
    const current = pointsByWeekAndPlayer.get(key) ?? 0;
    pointsByWeekAndPlayer.set(key, current + calculateFantasyPoints(row));
  });

  const squadPlayersBySquad = new Map<
    string,
    { player_id: string; is_captain: boolean }[]
  >();
  (squadPlayers ?? []).forEach((row) => {
    const list = squadPlayersBySquad.get(row.squad_id) ?? [];
    list.push(row);
    squadPlayersBySquad.set(row.squad_id, list);
  });

  return relevantSquads.map((squad) => {
    const rows = squadPlayersBySquad.get(squad.id) ?? [];

    const players: SquadPlayerResult[] = rows.map((row) => {
      const rawPoints =
        pointsByWeekAndPlayer.get(`${squad.round_id}:${row.player_id}`) ?? 0;
      const points = row.is_captain ? rawPoints * 2 : rawPoints;

      return {
        playerId: row.player_id,
        fullName: playerNameById.get(row.player_id) ?? "—",
        isCaptain: row.is_captain,
        points,
      };
    });

    const totalPoints = players.reduce((sum, p) => sum + p.points, 0);

    return {
      squadId: squad.id,
      userId: squad.user_id,
      weekId: squad.round_id,
      weekStartsAt: squad.fantasy_weeks!.starts_at,
      weekEndsAt: squad.fantasy_weeks!.ends_at,
      totalPoints,
      players,
    };
  });
}
