-- Box-score статистика игрока за конкретный матч.
-- Используется для расчёта фэнтези-очков по формуле:
-- PTS + REB*1.2 + AST*1.5 + STL*2 + BLK*2.5 + 3PM*0.5
--   - TO - 2PT_MISS*0.5 - 3PT_MISS*0.5 - FT_MISS*0.5

-- В базе уже была пустая заготовка player_match_stats с другой структурой
-- (did_play/minutes_played/points/fantasy_points, без данных) — пересоздаём
-- под фактическую формулу.
drop table if exists player_match_stats cascade;

create table if not exists player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,

  two_pt_made integer not null default 0,
  two_pt_miss integer not null default 0,
  three_pt_made integer not null default 0,
  three_pt_miss integer not null default 0,
  ft_made integer not null default 0,
  ft_miss integer not null default 0,

  rebounds integer not null default 0,
  assists integer not null default 0,
  steals integer not null default 0,
  blocks integer not null default 0,
  turnovers integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (match_id, player_id)
);

create index if not exists player_match_stats_match_id_idx
  on player_match_stats (match_id);

create index if not exists player_match_stats_player_id_idx
  on player_match_stats (player_id);

alter table player_match_stats enable row level security;

-- Статистика видна всем (как players/matches) — нужна на странице команды
-- для подсчёта очков состава.
create policy "player_match_stats_select_all"
  on player_match_stats for select
  using (true);

-- Писать может только админ (profiles.is_admin), как и остальные
-- справочные/игровые таблицы, которые правит admin-панель.
create policy "player_match_stats_insert_admin"
  on player_match_stats for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "player_match_stats_update_admin"
  on player_match_stats for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create policy "player_match_stats_delete_admin"
  on player_match_stats for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists player_match_stats_set_updated_at on player_match_stats;
create trigger player_match_stats_set_updated_at
  before update on player_match_stats
  for each row execute function set_updated_at();
