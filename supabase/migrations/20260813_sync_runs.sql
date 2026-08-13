-- Лог запусков синхронизации с ABL — нужен только чтобы на дашборде
-- админки показать "последняя синхронизация: когда и какой дивизион".
-- Одна строка на каждый успешно завершённый прогон syncAblTournament().
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  division_alias text not null,
  division_label text not null,
  finished_at timestamptz not null default now(),
  teams int not null,
  players int not null,
  rounds int not null,
  matches int not null,
  stats int not null,
  warnings int not null
);

alter table sync_runs enable row level security;

drop policy if exists "sync_runs_select_admin" on sync_runs;
create policy "sync_runs_select_admin"
  on sync_runs for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );

drop policy if exists "sync_runs_insert_admin" on sync_runs;
create policy "sync_runs_insert_admin"
  on sync_runs for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin
    )
  );
