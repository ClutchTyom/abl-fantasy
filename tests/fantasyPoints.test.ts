import { describe, expect, it } from "vitest";
import { calculateFantasyPoints, calculatePoints } from "@/lib/fantasyPoints";
import { EMPTY_STAT_LINE, StatLine } from "@/types/playerMatchStats";

const line = (overrides: Partial<StatLine>): StatLine => ({
  ...EMPTY_STAT_LINE,
  ...overrides,
});

describe("calculatePoints", () => {
  it("считает 2 очка за 2PT, 3 за 3PT и 1 за штрафной", () => {
    expect(calculatePoints(line({ two_pt_made: 4, three_pt_made: 2, ft_made: 3 }))).toBe(
      4 * 2 + 2 * 3 + 3
    );
  });

  it("не учитывает промахи", () => {
    expect(
      calculatePoints(line({ two_pt_miss: 5, three_pt_miss: 5, ft_miss: 5 }))
    ).toBe(0);
  });
});

describe("calculateFantasyPoints", () => {
  it("пустая статистика даёт 0", () => {
    expect(calculateFantasyPoints(EMPTY_STAT_LINE)).toBe(0);
  });

  it("применяет все коэффициенты формулы", () => {
    const stats = line({
      two_pt_made: 3, // 6
      three_pt_made: 2, // 6 + 1 (бонус 0.5 за каждую трёшку)
      ft_made: 2, // 2
      rebounds: 5, // 6
      assists: 4, // 6
      steals: 2, // 4
      blocks: 2, // 5
      turnovers: 3, // -3
      two_pt_miss: 2, // -1
      three_pt_miss: 4, // -2
      ft_miss: 2, // -1
    });

    // очки 14 + 6 + 6 + 4 + 5 + 1 - 3 - 1 - 2 - 1
    expect(calculateFantasyPoints(stats)).toBeCloseTo(29, 10);
  });

  it("потери и промахи уводят результат в минус", () => {
    expect(
      calculateFantasyPoints(line({ turnovers: 4, two_pt_miss: 4, ft_miss: 2 }))
    ).toBeCloseTo(-7, 10);
  });

  it("трёхочковый стоит 3.5 фэнтези-очка", () => {
    expect(calculateFantasyPoints(line({ three_pt_made: 1 }))).toBeCloseTo(3.5, 10);
  });
});
