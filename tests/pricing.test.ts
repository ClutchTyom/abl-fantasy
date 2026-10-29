import { describe, expect, it } from "vitest";
import {
  assignPrices,
  MAX_PRICE,
  MIN_GAMES_FOR_TIER,
  MIN_PRICE,
  PlayerPerformance,
} from "@/lib/pricing";

function makePlayers(count: number, games = 5): PlayerPerformance[] {
  // игрок i играет лучше игрока i+1
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    games,
    avgFantasyPoints: count - i,
  }));
}

describe("assignPrices", () => {
  it("игроки с малым числом матчей получают минимальную цену", () => {
    const prices = assignPrices([
      { playerId: "rookie", games: MIN_GAMES_FOR_TIER - 1, avgFantasyPoints: 99 },
      { playerId: "none", games: 0, avgFantasyPoints: 0 },
    ]);

    expect(prices.get("rookie")).toBe(MIN_PRICE);
    expect(prices.get("none")).toBe(MIN_PRICE);
  });

  it("лучший игрок получает максимальную цену, худший — минимальную", () => {
    const prices = assignPrices(makePlayers(100));

    expect(prices.get("p0")).toBe(MAX_PRICE);
    expect(prices.get("p99")).toBe(MIN_PRICE);
  });

  it("цена не растёт при ухудшении результата", () => {
    const prices = assignPrices(makePlayers(200));
    let previous = Infinity;

    for (let i = 0; i < 200; i++) {
      const price = prices.get(`p${i}`)!;
      expect(price).toBeLessThanOrEqual(previous);
      previous = price;
    }
  });

  it("квота максимальной цены — 2% прошедших порог", () => {
    const prices = assignPrices(makePlayers(200));
    const top = [...prices.values()].filter((p) => p === MAX_PRICE).length;

    expect(top).toBe(4);
  });

  it("все цены в допустимом диапазоне и назначены каждому игроку", () => {
    const players = makePlayers(137);
    const prices = assignPrices(players);

    expect(prices.size).toBe(players.length);
    for (const price of prices.values()) {
      expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
      expect(price).toBeLessThanOrEqual(MAX_PRICE);
    }
  });

  it("пустой список не падает", () => {
    expect(assignPrices([]).size).toBe(0);
  });

  it("при раздельном расчёте по залам у каждого зала свой потолок цен", () => {
    // Слабый зал со средними очками ~5 и сильный с ~50: общий расчёт отдал
    // бы все дорогие цены сильному залу, раздельный — по 2% каждому.
    const weak = makePlayers(100).map((p) => ({
      ...p,
      playerId: `w${p.playerId}`,
      avgFantasyPoints: p.avgFantasyPoints / 20,
    }));
    const strong = makePlayers(100).map((p) => ({
      ...p,
      playerId: `s${p.playerId}`,
      avgFantasyPoints: p.avgFantasyPoints + 50,
    }));

    const pooled = assignPrices([...weak, ...strong]);
    const weakTop = (prices: Map<string, number>) =>
      [...prices.entries()].filter(([id, p]) => id.startsWith("w") && p === MAX_PRICE)
        .length;

    expect(weakTop(pooled)).toBe(0);
    expect(weakTop(assignPrices(weak))).toBe(2);
  });
});
