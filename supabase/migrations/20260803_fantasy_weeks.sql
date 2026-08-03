-- Раньше fantasy_squads.round_id указывал прямо на rounds (тур конкретного
-- дивизиона ABL). После синхронизации 13 дивизионов туры пошли параллельно
-- в каждом дивизионе, и "ближайший upcoming тур" стал бессмысленным без
-- указания дивизиона. У ABL все туры физически проходят по выходным, так
-- что вводим отдельное понятие "фэнтези-тур" — календарная неделя с
-- блокировкой в 09:00 субботы (МСК = UTC+3), общая для всех дивизионов.
-- Очки считаются по ВСЕМ матчам (любого дивизиона), попавшим в диапазон
-- [starts_at, ends_at) этой недели.
create table if not exists fantasy_weeks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table fantasy_weeks enable row level security;

drop policy if exists "fantasy_weeks_select_all" on fantasy_weeks;
create policy "fantasy_weeks_select_all"
  on fantasy_weeks for select
  using (true);

-- Недели создаются лениво из браузера любого залогиненного пользователя
-- (детерминированная дата следующей субботы 09:00, unique(starts_at)
-- защищает от дублей) — поэтому insert открыт всем авторизованным.
drop policy if exists "fantasy_weeks_insert_authenticated" on fantasy_weeks;
create policy "fantasy_weeks_insert_authenticated"
  on fantasy_weeks for insert
  to authenticated
  with check (true);

-- ВНИМАНИЕ: существующие тестовые составы (например, тур "Фип") ссылались
-- на старые rounds-строки и не будут соответствовать новой схеме — это
-- тестовые данные, которые нужно пересобрать после миграции.
delete from fantasy_squad_players;
delete from fantasy_squads;

alter table fantasy_squads drop constraint if exists fantasy_squads_round_id_fkey;
alter table fantasy_squads
  add constraint fantasy_squads_round_id_fkey
  foreign key (round_id) references fantasy_weeks(id) on delete cascade;

-- Блокировка по времени теперь проверяется по fantasy_weeks, а не rounds.
drop policy if exists "fantasy_squads_lock_insert" on fantasy_squads;
create policy "fantasy_squads_lock_insert"
  on fantasy_squads as restrictive for insert
  with check (
    exists (
      select 1 from fantasy_weeks
      where fantasy_weeks.id = round_id and fantasy_weeks.starts_at > now()
    )
  );

drop policy if exists "fantasy_squads_lock_update" on fantasy_squads;
create policy "fantasy_squads_lock_update"
  on fantasy_squads as restrictive for update
  with check (
    exists (
      select 1 from fantasy_weeks
      where fantasy_weeks.id = round_id and fantasy_weeks.starts_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_insert" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_insert"
  on fantasy_squad_players as restrictive for insert
  with check (
    exists (
      select 1 from fantasy_squads
      join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and fantasy_weeks.starts_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_update" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_update"
  on fantasy_squad_players as restrictive for update
  with check (
    exists (
      select 1 from fantasy_squads
      join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and fantasy_weeks.starts_at > now()
    )
  );

drop policy if exists "fantasy_squad_players_lock_delete" on fantasy_squad_players;
create policy "fantasy_squad_players_lock_delete"
  on fantasy_squad_players as restrictive for delete
  using (
    exists (
      select 1 from fantasy_squads
      join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
      where fantasy_squads.id = squad_id and fantasy_weeks.starts_at > now()
    )
  );
