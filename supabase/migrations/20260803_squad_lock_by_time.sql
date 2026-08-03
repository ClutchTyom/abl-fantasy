-- Состав должен реально блокироваться по времени начала тура (rounds.lock_at),
-- а не только по ручному admin-флагу fantasy_squads.is_locked, который никто
-- не выставляет автоматически. Обычные (permissive) policy складываются по
-- OR и не могут что-то ЗАПРЕТИТЬ поверх уже разрешающих правил — поэтому
-- здесь нужны RESTRICTIVE policy: они AND'ятся со всеми остальными и режут
-- запись независимо от того, как называются/что разрешают существующие
-- policy на этих таблицах.

drop policy if exists "fantasy_squads_lock_insert" on fantasy_squads;
create policy "fantasy_squads_lock_insert"
  on fantasy_squads as restrictive for insert
  with check (
    exists (
      select 1 from rounds
      where rounds.id = round_id and rounds.lock_at > now()
    )
  );

drop policy if exists "fantasy_squads_lock_update" on fantasy_squads;
create policy "fantasy_squads_lock_update"
  on fantasy_squads as restrictive for update
  with check (
    exists (
      select 1 from rounds
      where rounds.id = round_id and rounds.lock_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_insert" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_insert"
  on fantasy_squad_players as restrictive for insert
  with check (
    exists (
      select 1 from fantasy_squads
      join rounds on rounds.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and rounds.lock_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_update" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_update"
  on fantasy_squad_players as restrictive for update
  with check (
    exists (
      select 1 from fantasy_squads
      join rounds on rounds.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and rounds.lock_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_delete" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_delete"
  on fantasy_squad_players as restrictive for delete
  using (
    exists (
      select 1 from fantasy_squads
      join rounds on rounds.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and rounds.lock_at > now()
    )
  );
