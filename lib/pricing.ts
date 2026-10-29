import { supabase } from "@/lib/supabaseClient";
import { calculateFantasyPoints } from "@/lib/fantasyPoints";
import { fetchAllRows } from "@/lib/fetchAll";
import { PlayerMatchStats, StatLine } from "@/types/playerMatchStats";

export const MIN_PRICE = 6;
export const MAX_PRICE = 17;
export const MIN_GAMES_FOR_TIER = 2;

// Квоты считаются от игроков, прошедших порог MIN_GAMES_FOR_TIER,
// от сильнейших (по среднему фэнтези-очку за игру) к слабейшим.
// Всё, что не попало ни в одну квоту (включая тех, кто порог не прошёл),
// получает MIN_PRICE.
export const PRICE_QUOTAS: { price: number; share: number }[] = [
  { price: 17, share: 0.02 },
  { price: 16, share: 0.03 },
  { price: 15, share: 0.05 },
  { price: 14, share: 0.05 },
  { price: 13, share: 0.1 },
  { price: 12, share: 0.15 },
  { price: 11, share: 0.15 },
  { price: 10, share: 0.15 },
  { price: 9, share: 0.15 },
];

export type PlayerPerformance = {
  playerId: string;
  games: number;
  avgFantasyPoints: number;
};

export function assignPrices(
  performances: PlayerPerformance[]
): Map<string, number> {
  const prices = new Map<string, number>();

  const eligible = performances
    .filter((p) => p.games >= MIN_GAMES_FOR_TIER)
    .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints);

  performances
    .filter((p) => p.games < MIN_GAMES_FOR_TIER)
    .forEach((p) => prices.set(p.playerId, MIN_PRICE));

  const total = eligible.length;
  let cumulativeShare = 0;
  let index = 0;

  for (const tier of PRICE_QUOTAS) {
    cumulativeShare += tier.share;
    const endIndex = Math.round(cumulativeShare * total);
    for (; index < endIndex; index++) {
      prices.set(eligible[index].playerId, tier.price);
    }
  }

  for (; index < total; index++) {
    prices.set(eligible[index].playerId, MIN_PRICE);
  }

  return prices;
}

export type PriceDistribution = { price: number; count: number }[];

export type HallPriceSummary = {
  hallName: string;
  players: number;
  eligiblePlayers: number;
  priceDistribution: PriceDistribution;
};

export type PriceRecalcSummary = {
  playersUpdated: number;
  eligiblePlayers: number;
  priceDistribution: PriceDistribution;
  halls: HallPriceSummary[];
};

// Игроки без зала (например, созданные вручную) считаются отдельной
// группой со своими квотами.
const NO_HALL_KEY = "none";

// PostgREST отдаёт связь many-to-one объектом, но без сгенерированных типов
// supabase-js выводит её массивом — поддерживаем оба варианта.
type HallRef = { hall_id: string | null };
type PlayerRow = { id: string; teams: HallRef | HallRef[] | null };

function hallIdOf(player: PlayerRow): string | null {
  const team = Array.isArray(player.teams) ? player.teams[0] : player.teams;
  return team?.hall_id ?? null;
}

function distributionOf(prices: Iterable<number>): PriceDistribution {
  const counts = new Map<number, number>();
  for (const price of prices) {
    counts.set(price, (counts.get(price) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([price, count]) => ({ price, count }))
    .sort((a, b) => b.price - a.price);
}

export async function recalculatePlayerPrices(): Promise<PriceRecalcSummary> {
  let players: PlayerRow[];
  let halls: { id: string; name: string }[];
  let statsRows: Pick<
    PlayerMatchStats,
    | "player_id"
    | "two_pt_made"
    | "two_pt_miss"
    | "three_pt_made"
    | "three_pt_miss"
    | "ft_made"
    | "ft_miss"
    | "rebounds"
    | "assists"
    | "steals"
    | "blocks"
    | "turnovers"
  >[];

  try {
    // Архивные игроки (прошлые сезоны) в расчёте не участвуют: иначе квоты
    // цен делились бы и на них, и у нынешних игроков распределение цен
    // было бы смещено вниз. Их цены остаются прежними.
    players = await fetchAllRows<PlayerRow>((from, to) =>
      supabase
        .from("players")
        .select("id, teams(hall_id)")
        .is("archived_at", null)
        .range(from, to)
    );

    const { data: hallsData, error: hallsError } = await supabase
      .from("halls")
      .select("id, name")
      .order("sort");
    if (hallsError) throw new Error(hallsError.message);
    halls = hallsData ?? [];

    statsRows = await fetchAllRows((from, to) =>
      supabase
        .from("player_match_stats")
        .select(
          "player_id, two_pt_made, two_pt_miss, three_pt_made, three_pt_miss, ft_made, ft_miss, rebounds, assists, steals, blocks, turnovers"
        )
        .range(from, to)
    );
  } catch (err) {
    throw new Error(
      `Не удалось загрузить игроков/статистику: ${err instanceof Error ? err.message : err}`
    );
  }

  const totalsByPlayer = new Map<string, { games: number; points: number }>();

  statsRows.forEach((row) => {
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

    const current = totalsByPlayer.get(row.player_id) ?? { games: 0, points: 0 };
    current.games += 1;
    current.points += calculateFantasyPoints(stats);
    totalsByPlayer.set(row.player_id, current);
  });

  // Цена зависит от места игрока среди игроков СВОЕГО зала: в каждом зале
  // свой рынок со своими квотами (сколько игроков по 17, 16 и т.д.), потому
  // что рейтинг и состав тоже считаются внутри зала.
  const performancesByHall = new Map<string, PlayerPerformance[]>();

  players.forEach((player) => {
    const totals = totalsByPlayer.get(player.id);
    const key = hallIdOf(player) ?? NO_HALL_KEY;
    const group = performancesByHall.get(key) ?? [];
    group.push({
      playerId: player.id,
      games: totals?.games ?? 0,
      avgFantasyPoints: totals ? totals.points / totals.games : 0,
    });
    performancesByHall.set(key, group);
  });

  const prices = new Map<string, number>();
  const hallSummaries: HallPriceSummary[] = [];

  const hallOrder = [...halls.map((h) => h.id), NO_HALL_KEY];
  for (const key of hallOrder) {
    const group = performancesByHall.get(key);
    if (!group) continue;

    const hallPrices = assignPrices(group);
    hallPrices.forEach((price, playerId) => prices.set(playerId, price));

    hallSummaries.push({
      hallName: halls.find((h) => h.id === key)?.name ?? "Без зала",
      players: group.length,
      eligiblePlayers: group.filter((p) => p.games >= MIN_GAMES_FOR_TIER).length,
      priceDistribution: distributionOf(hallPrices.values()),
    });
  }

  const performances = Array.from(performancesByHall.values()).flat();

  const rows = Array.from(prices.entries()).map(([id, price]) => ({ id, price }));

  // Точечный update, а не upsert: upsert строит INSERT ... ON CONFLICT DO
  // UPDATE, а для этого Postgres требует заполненными все NOT NULL поля
  // строки (team_id, full_name, position...) ещё до проверки конфликта,
  // хотя реально всегда происходит только UPDATE уже существующего игрока.
  const CONCURRENCY = 20;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ id, price }) =>
        supabase.from("players").update({ price }).eq("id", id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      throw new Error(`Не удалось сохранить новые цены: ${failed.error.message}`);
    }
  }

  const priceDistribution = distributionOf(prices.values());

  return {
    playersUpdated: rows.length,
    eligiblePlayers: performances.filter((p) => p.games >= MIN_GAMES_FOR_TIER).length,
    priceDistribution,
    halls: hallSummaries,
  };
}
