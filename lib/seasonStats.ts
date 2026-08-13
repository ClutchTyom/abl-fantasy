import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { calculatePoints, calculateFantasyPoints } from "@/lib/fantasyPoints";
import { StatLine } from "@/types/playerMatchStats";

export type SeasonStats = {
  games: number;
  avgPoints: number;
  avgFantasyPoints: number;
};

type StatRow = StatLine & { player_id: string };

// Средние показатели игрока за регулярный сезон (по всем сыгранным матчам
// со статистикой) — показываются на карточке игрока в /players и на
// странице команды вместо кнопки добавления в состав.
export async function fetchSeasonStatsByPlayer(): Promise<
  Map<string, SeasonStats>
> {
  const rows = await fetchAllRows<StatRow>((from, to) =>
    supabase
      .from("player_match_stats")
      .select(
        "player_id, two_pt_made, two_pt_miss, three_pt_made, three_pt_miss, ft_made, ft_miss, rebounds, assists, steals, blocks, turnovers"
      )
      .range(from, to)
  );

  const totals = new Map<
    string,
    { games: number; points: number; fantasyPoints: number }
  >();

  rows.forEach((row) => {
    const current = totals.get(row.player_id) ?? {
      games: 0,
      points: 0,
      fantasyPoints: 0,
    };
    current.games += 1;
    current.points += calculatePoints(row);
    current.fantasyPoints += calculateFantasyPoints(row);
    totals.set(row.player_id, current);
  });

  const result = new Map<string, SeasonStats>();
  totals.forEach((value, playerId) => {
    result.set(playerId, {
      games: value.games,
      avgPoints: value.points / value.games,
      avgFantasyPoints: value.fantasyPoints / value.games,
    });
  });

  return result;
}
