-- Общий рейтинг показывает результаты всех участников, а не только
-- текущего пользователя, так что чтение fantasy_squads/fantasy_squad_players
-- и username из profiles должно быть открыто всем авторизованным, а не
-- только владельцу записи. Permissive-политики в Postgres складываются по
-- OR, так что это не мешает уже существующим политикам записи — они
-- как ограничивали изменение только своих строк, так и продолжат.

drop policy if exists "fantasy_squads_select_all" on fantasy_squads;
create policy "fantasy_squads_select_all"
  on fantasy_squads for select
  using (true);

drop policy if exists "fantasy_squad_players_select_all" on fantasy_squad_players;
create policy "fantasy_squad_players_select_all"
  on fantasy_squad_players for select
  using (true);

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all"
  on profiles for select
  using (true);
