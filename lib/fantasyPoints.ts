import { StatLine } from "@/types/playerMatchStats";

// Очки, набранные игроком в матче (2 очка за 2PT, 3 за 3PT, 1 за штрафной).
export function calculatePoints(stats: StatLine): number {
  return stats.two_pt_made * 2 + stats.three_pt_made * 3 + stats.ft_made;
}

// PTS + REB*1.2 + AST*1.5 + STL*2 + BLK*2.5 + 3PM*0.5
//   - TO - 2PT_MISS*0.5 - 3PT_MISS*0.5 - FT_MISS*0.5
export function calculateFantasyPoints(stats: StatLine): number {
  const pts = calculatePoints(stats);

  return (
    pts +
    stats.rebounds * 1.2 +
    stats.assists * 1.5 +
    stats.steals * 2 +
    stats.blocks * 2.5 +
    stats.three_pt_made * 0.5 -
    stats.turnovers -
    stats.two_pt_miss * 0.5 -
    stats.three_pt_miss * 0.5 -
    stats.ft_miss * 0.5
  );
}
