import { describe, expect, it } from "vitest";
import { isAllowedAblPath } from "@/lib/abl/allowedPaths";

describe("isAllowedAblPath", () => {
  it.each([
    "/league/2/tournaments/soft26-27/",
    "/league/2/tournaments/grow26-28/",
    "/tournament/4361/teams/",
    "/tournament/4361/games/",
    "/tournament_team/123/users/",
    "/tournament_game/456/users/",
    "/tournament_basketball_game/456/user_statistic/",
  ])("разрешает %s", (path) => {
    expect(isAllowedAblPath(path)).toBe(true);
  });

  it.each([
    null,
    "",
    "/",
    "/users/",
    "/league/2/tournaments/../../users/",
    "/tournament/4361/../../admin/",
    "/tournament/abc/teams/",
    "/tournament/4361/teams",
    "//evil.com/",
    "https://evil.com/tournament/1/teams/",
    "/tournament/4361/teams/?x=1",
    "/league/2/tournaments/a b/",
  ])("отклоняет %s", (path) => {
    expect(isAllowedAblPath(path)).toBe(false);
  });
});
