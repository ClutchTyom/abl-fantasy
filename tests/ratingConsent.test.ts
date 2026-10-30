import { describe, expect, it } from "vitest";
import { HIDDEN_PLAYER_NAME, publicDisplayName } from "@/lib/ratingConsent";

describe("publicDisplayName", () => {
  it("показывает ник только при согласии", () => {
    expect(publicDisplayName("Артём", true)).toBe("Артём");
    expect(publicDisplayName("Артём", false)).toBe(HIDDEN_PLAYER_NAME);
  });

  it("скрывает пустой или отсутствующий ник даже при согласии", () => {
    expect(publicDisplayName(null, true)).toBe(HIDDEN_PLAYER_NAME);
    expect(publicDisplayName("  ", true)).toBe(HIDDEN_PLAYER_NAME);
  });
});
