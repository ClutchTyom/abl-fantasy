-- Календарь игр (/schedule) доступен без входа в аккаунт, в отличие от
-- /players и /team. Явно гарантируем, что teams/rounds/matches читаются
-- ЛЮБЫМ посетителем (без "to authenticated"), а не только залогиненными —
-- эти select-политики могли быть заведены ещё до миграций и ограничены
-- ролью authenticated. Permissive-политики складываются по OR, так что
-- эта просто расширяет доступ, ничего не отбирая у существующих политик.
drop policy if exists "teams_select_all" on teams;
create policy "teams_select_all"
  on teams for select
  using (true);

drop policy if exists "rounds_select_all" on rounds;
create policy "rounds_select_all"
  on rounds for select
  using (true);

drop policy if exists "matches_select_all" on matches;
create policy "matches_select_all"
  on matches for select
  using (true);
