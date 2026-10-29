-- Старая модель состава (user_teams / user_team_roster) заменена на
-- fantasy_squads / fantasy_squad_players. Перед удалением проверено: обе
-- таблицы пусты, на них нет внешних ключей и зависимых объектов, код сайта
-- их не использует. Порядок: сначала дочерняя таблица.
drop table if exists public.user_team_roster;
drop table if exists public.user_teams;
