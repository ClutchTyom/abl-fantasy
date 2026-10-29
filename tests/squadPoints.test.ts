import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeAllSquadResults } from "@/lib/squadPoints";
import { fakeSupabase } from "./fakeSupabase";

// Фэнтези-очки в статистике ниже считаются вручную по формуле:
// 2PT*2 + 3PT*3 + FT + REB*1.2 + AST*1.5 + STL*2 + BLK*2.5 + 3PM*0.5 - TO - промахи*0.5
const stat = (over: Record<string, number> = {}) => ({
  two_pt_made: 0,
  two_pt_miss: 0,
  three_pt_made: 0,
  three_pt_miss: 0,
  ft_made: 0,
  ft_miss: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  ...over,
});

const WEEK1 = { starts_at: "2026-10-24T06:00:00.000Z", ends_at: "2026-10-31T06:00:00.000Z" };
const WEEK2 = { starts_at: "2026-10-31T06:00:00.000Z", ends_at: "2026-11-07T06:00:00.000Z" };
const FUTURE = { starts_at: "2099-01-01T06:00:00.000Z", ends_at: "2099-01-08T06:00:00.000Z" };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z")); // после WEEK2
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeAllSquadResults", () => {
  it("возвращает пустой результат, если составов нет", async () => {
    const result = await computeAllSquadResults(fakeSupabase({ fantasy_squads: [] }));
    expect(result).toEqual([]);
  });

  it("не включает составы недель, которые ещё не начались", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "wF", fantasy_weeks: FUTURE },
      ],
    });

    expect(await computeAllSquadResults(client)).toEqual([]);
  });

  it("суммирует очки игроков состава за матчи недели", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
      ],
      fantasy_squad_players: [
        { squad_id: "s1", player_id: "pA", is_captain: false },
        { squad_id: "s1", player_id: "pB", is_captain: false },
      ],
      players: [
        { id: "pA", full_name: "Алексей А" },
        { id: "pB", full_name: "Борис Б" },
      ],
      matches: [
        { id: "m1", starts_at: "2026-10-25T10:00:00.000Z" },
        { id: "m2", starts_at: "2026-10-26T10:00:00.000Z" },
      ],
      player_match_stats: [
        { match_id: "m1", player_id: "pA", ...stat({ two_pt_made: 5 }) }, // 10
        { match_id: "m2", player_id: "pA", ...stat({ ft_made: 4 }) }, // 4
        { match_id: "m1", player_id: "pB", ...stat({ rebounds: 5 }) }, // 6
      ],
    });

    const [result] = await computeAllSquadResults(client);

    expect(result.userId).toBe("u1");
    expect(result.weekId).toBe("w1");
    expect(result.totalPoints).toBeCloseTo(20, 10);
    expect(result.players.find((p) => p.playerId === "pA")?.points).toBeCloseTo(14, 10);
    expect(result.players.find((p) => p.playerId === "pB")?.fullName).toBe("Борис Б");
  });

  it("удваивает очки капитана", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
      ],
      fantasy_squad_players: [
        { squad_id: "s1", player_id: "pA", is_captain: true },
        { squad_id: "s1", player_id: "pB", is_captain: false },
      ],
      players: [
        { id: "pA", full_name: "А" },
        { id: "pB", full_name: "Б" },
      ],
      matches: [{ id: "m1", starts_at: "2026-10-25T10:00:00.000Z" }],
      player_match_stats: [
        { match_id: "m1", player_id: "pA", ...stat({ two_pt_made: 5 }) }, // 10, x2
        { match_id: "m1", player_id: "pB", ...stat({ two_pt_made: 5 }) }, // 10
      ],
    });

    const [result] = await computeAllSquadResults(client);

    expect(result.players.find((p) => p.playerId === "pA")?.points).toBe(20);
    expect(result.players.find((p) => p.playerId === "pB")?.points).toBe(10);
    expect(result.totalPoints).toBe(30);
  });

  it("относит матчи к неделе по времени: граница недели принадлежит следующей", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
        { id: "s2", user_id: "u1", round_id: "w2", fantasy_weeks: WEEK2 },
      ],
      fantasy_squad_players: [
        { squad_id: "s1", player_id: "pA", is_captain: false },
        { squad_id: "s2", player_id: "pA", is_captain: false },
      ],
      players: [{ id: "pA", full_name: "А" }],
      matches: [
        { id: "inW1", starts_at: "2026-10-30T20:00:00.000Z" },
        { id: "atBoundary", starts_at: "2026-10-31T06:00:00.000Z" }, // начало WEEK2
        { id: "inW2", starts_at: "2026-11-01T10:00:00.000Z" },
      ],
      player_match_stats: [
        { match_id: "inW1", player_id: "pA", ...stat({ two_pt_made: 1 }) }, // 2, неделя 1
        { match_id: "atBoundary", player_id: "pA", ...stat({ two_pt_made: 2 }) }, // 4, неделя 2
        { match_id: "inW2", player_id: "pA", ...stat({ two_pt_made: 3 }) }, // 6, неделя 2
      ],
    });

    const results = await computeAllSquadResults(client);
    const week1 = results.find((r) => r.weekId === "w1")!;
    const week2 = results.find((r) => r.weekId === "w2")!;

    expect(week1.totalPoints).toBe(2);
    expect(week2.totalPoints).toBe(10);
  });

  it("игнорирует матчи вне всех недель и очки игроков не из состава", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
      ],
      fantasy_squad_players: [{ squad_id: "s1", player_id: "pA", is_captain: false }],
      players: [{ id: "pA", full_name: "А" }],
      matches: [
        { id: "old", starts_at: "2026-09-01T10:00:00.000Z" }, // раньше всех недель
        { id: "m1", starts_at: "2026-10-25T10:00:00.000Z" },
      ],
      player_match_stats: [
        { match_id: "old", player_id: "pA", ...stat({ two_pt_made: 50 }) },
        { match_id: "m1", player_id: "stranger", ...stat({ two_pt_made: 50 }) },
        { match_id: "m1", player_id: "pA", ...stat({ two_pt_made: 1 }) },
      ],
    });

    const [result] = await computeAllSquadResults(client);

    expect(result.totalPoints).toBe(2);
  });

  it("считает составы разных пользователей независимо", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
        { id: "s2", user_id: "u2", round_id: "w1", fantasy_weeks: WEEK1 },
      ],
      fantasy_squad_players: [
        { squad_id: "s1", player_id: "pA", is_captain: false },
        { squad_id: "s2", player_id: "pB", is_captain: true },
      ],
      players: [
        { id: "pA", full_name: "А" },
        { id: "pB", full_name: "Б" },
      ],
      matches: [{ id: "m1", starts_at: "2026-10-25T10:00:00.000Z" }],
      player_match_stats: [
        { match_id: "m1", player_id: "pA", ...stat({ two_pt_made: 3 }) }, // 6
        { match_id: "m1", player_id: "pB", ...stat({ two_pt_made: 3 }) }, // 6, x2
      ],
    });

    const results = await computeAllSquadResults(client);

    expect(results.find((r) => r.userId === "u1")?.totalPoints).toBe(6);
    expect(results.find((r) => r.userId === "u2")?.totalPoints).toBe(12);
  });

  it("состав без игроков даёт 0 очков", async () => {
    const client = fakeSupabase({
      fantasy_squads: [
        { id: "s1", user_id: "u1", round_id: "w1", fantasy_weeks: WEEK1 },
      ],
      fantasy_squad_players: [],
      players: [],
      matches: [],
      player_match_stats: [],
    });

    const [result] = await computeAllSquadResults(client);

    expect(result.totalPoints).toBe(0);
    expect(result.players).toEqual([]);
  });
});
