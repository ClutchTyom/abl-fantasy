export type PlayerMatchStats = {
  id: string;
  match_id: string;
  player_id: string;
  two_pt_made: number;
  two_pt_miss: number;
  three_pt_made: number;
  three_pt_miss: number;
  ft_made: number;
  ft_miss: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

export type StatLine = Omit<PlayerMatchStats, "id" | "match_id" | "player_id">;

export const EMPTY_STAT_LINE: StatLine = {
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
};
