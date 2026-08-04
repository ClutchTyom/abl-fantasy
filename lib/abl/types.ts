// Минимальные типы под ответы API mtgame.ru (бэкенд ablforpeople.com).
// Указаны только поля, которые реально используются при импорте.

export type AblTournament = {
  id: number;
  name: string;
  alias: string;
};

export type AblTournamentTeam = {
  id: number; // tournament_team id — нужен для запроса состава
  team: {
    id: number; // стабильный id команды, используем как внешний ключ
    name: string;
    logo: { path: string } | null;
  };
};

export type AblBasketballProfile = {
  position: string | null;
};

export type AblUser = {
  id: number; // стабильный id человека — внешний ключ игрока
  first_name: string | null;
  last_name: string | null;
  photo: { path: string } | null;
  basketball_profile: AblBasketballProfile | null;
};

export type AblRosterEntry = {
  id: number;
  team_user: {
    id: number;
    user: AblUser;
  };
};

export type AblGame = {
  id: number;
  status: string; // "draft" | "closed" | ...
  datetime: string | null;
  team_id: number | null;
  competitor_team_id: number | null;
  team: { id: number; name: string } | null;
  competitor_team: { id: number; name: string } | null;
  tournament_tour: number | null;
  playoff_round: number | null;
  playoff_stage: string | null;
};

export type AblGameUser = {
  id: number; // game_user_id — ключ для join со статистикой
  team_user: {
    id: number;
    user: { id: number };
  };
};

export type AblUserStatistic = {
  game_user_id: number;
  points: number;
  two_points_made: number;
  two_point_attempts: number;
  three_points_made: number;
  three_point_attempts: number;
  free_throws_made: number;
  free_throw_attempts: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};
