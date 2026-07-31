export type Player = {
  id: string;
  team_id: string;
  full_name: string;
  position: "PG" | "SG" | "SF" | "PF" | "C";
  price: number;
  photo_url: string | null;
  teams: {
    name: string;
    short_name: string;
  } | null;
};