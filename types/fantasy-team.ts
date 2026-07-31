export interface FantasyTeam {
  id: number;

  name: string;

  playerIds: number[];

  captainId: number | null;

  budget: number;

  spent: number;
}