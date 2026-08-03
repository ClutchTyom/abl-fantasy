import { supabase } from "@/lib/supabaseClient";
import { calculateFantasyPoints } from "@/lib/fantasyPoints";
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
  roundId: string;
  roundName: string;
  roundStatus: string;
  totalPoints: number;
  players: SquadPlayerResult[];
};

// Очки всех сохранённых составов по турам со статусом live/completed —
// используется и для личных результатов на "Моя команда", и для общего
// рейтинга. Никаких embed-джойнов через select("players(...)") — эта связь
// не резолвится (у fantasy_squad_players нет нужного foreign key для
// автосвязи), поэтому игроки и очки собираются отдельными запросами и
// объединяются на клиенте.
export async function computeAllSquadResults(): Promise<SquadResult[]> {
  const { data: squads } = await supabase
    .from("fantasy_squads")
    .select("id, user_id, round_id, rounds(name, status)");

  const relevantSquads = (
    (squads ?? []) as unknown as {
      id: string;
      user_id: string;
      round_id: string;
      rounds: { name: string; status: string } | null;
    }[]
  ).filter((s) => s.rounds?.status === "live" || s.rounds?.status === "completed");

  if (relevantSquads.length === 0) return [];

  const squadIds = relevantSquads.map((s) => s.id);
  const roundIds = Array.from(new Set(relevantSquads.map((s) => s.round_id)));

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

  const { data: matches } = await supabase
    .from("matches")
    .select("id, round_id")
    .in("round_id", roundIds);

  const matchIds = (matches ?? []).map((m) => m.id);

  const { data: statsRows } = matchIds.length
    ? await supabase.from("player_match_stats").select("*").in("match_id", matchIds)
    : { data: [] };

  // очки игрока в туре = сумма фэнтези-очков по всем его матчам в этом туре
  const matchToRound = new Map((matches ?? []).map((m) => [m.id, m.round_id]));
  const pointsByRoundAndPlayer = new Map<string, number>();

  (statsRows ?? []).forEach((row) => {
    const roundId = matchToRound.get(row.match_id);
    if (!roundId) return;

    const stats: StatLine = {
      two_pt_made: row.two_pt_made,
      two_pt_miss: row.two_pt_miss,
      three_pt_made: row.three_pt_made,
      three_pt_miss: row.three_pt_miss,
      ft_made: row.ft_made,
      ft_miss: row.ft_miss,
      rebounds: row.rebounds,
      assists: row.assists,
      steals: row.steals,
      blocks: row.blocks,
      turnovers: row.turnovers,
    };

    const key = `${roundId}:${row.player_id}`;
    const current = pointsByRoundAndPlayer.get(key) ?? 0;
    pointsByRoundAndPlayer.set(key, current + calculateFantasyPoints(stats));
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
        pointsByRoundAndPlayer.get(`${squad.round_id}:${row.player_id}`) ?? 0;
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
      roundId: squad.round_id,
      roundName: squad.rounds?.name ?? "—",
      roundStatus: squad.rounds?.status ?? "—",
      totalPoints,
      players,
    };
  });
}
