import { describe, expect, it } from "vitest";
import { decideAutoArchive } from "@/lib/archiveGuard";

const active = { teams: 200, players: 2500 };

describe("decideAutoArchive", () => {
  it("архивирует небольшой объём после чистого синка", () => {
    expect(
      decideAutoArchive({
        syncErrors: 0,
        toArchive: { teams: 5, players: 120 },
        active,
      })
    ).toEqual({ archive: true });
  });

  it("не архивирует, если были ошибки синхронизации", () => {
    const decision = decideAutoArchive({
      syncErrors: 2,
      toArchive: { teams: 5, players: 120 },
      active,
    });

    expect(decision.archive).toBe(false);
  });

  it("не архивирует, когда архивировать нечего", () => {
    const decision = decideAutoArchive({
      syncErrors: 0,
      toArchive: { teams: 0, players: 0 },
      active,
    });

    expect(decision).toEqual({ archive: false, reason: "архивировать нечего" });
  });

  it("не архивирует больше четверти команд", () => {
    const decision = decideAutoArchive({
      syncErrors: 0,
      toArchive: { teams: 51, players: 10 },
      active,
    });

    expect(decision.archive).toBe(false);
  });

  it("не архивирует больше четверти игроков", () => {
    const decision = decideAutoArchive({
      syncErrors: 0,
      toArchive: { teams: 1, players: 626 },
      active,
    });

    expect(decision.archive).toBe(false);
  });

  it("ровно четверть ещё допустима", () => {
    expect(
      decideAutoArchive({
        syncErrors: 0,
        toArchive: { teams: 50, players: 625 },
        active,
      })
    ).toEqual({ archive: true });
  });

  it("при пустой базе активных записей не архивирует", () => {
    const decision = decideAutoArchive({
      syncErrors: 0,
      toArchive: { teams: 3, players: 30 },
      active: { teams: 0, players: 0 },
    });

    expect(decision.archive).toBe(false);
  });
});
