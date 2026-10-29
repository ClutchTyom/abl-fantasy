-- Архив команд и игроков прошлых сезонов. Ничего не удаляем: на игроков и
-- команды ссылаются старые матчи, статистика и прошлые составы. Архивные
-- записи просто скрываются из списков и выбора игроков и могут быть
-- возвращены.
--
-- Актуальность определяется синхронизацией с ABL: каждый upsert
-- проставляет synced_at = now() и снимает архивный флаг. Команда, которую
-- давно не обновляла синхронизация, и игрок, который не попал в свежий
-- ростер своей команды, считаются устаревшими. Записи без abl_id (созданные
-- вручную в админке) в автоматический архив не попадают.

alter table public.teams add column if not exists archived_at timestamptz;
alter table public.teams add column if not exists synced_at timestamptz;
alter table public.players add column if not exists archived_at timestamptz;
alter table public.players add column if not exists synced_at timestamptz;

create or replace function public.bulk_upsert_teams(rows jsonb)
returns table(id uuid, abl_id text)
language plpgsql
set search_path = public
as $$
begin
  return query
  insert into teams (name, short_name, division, logo_url, abl_id, hall_id, synced_at, archived_at)
  select
    r->>'name',
    r->>'short_name',
    r->>'division',
    r->>'logo_url',
    r->>'abl_id',
    (select h.id from halls h where h.slug = r->>'hall_slug'),
    now(),
    null
  from jsonb_array_elements(rows) as r
  on conflict on constraint teams_abl_id_key do update set
    name = excluded.name,
    division = excluded.division,
    logo_url = excluded.logo_url,
    hall_id = coalesce(excluded.hall_id, teams.hall_id),
    synced_at = excluded.synced_at,
    archived_at = null
  returning teams.id, teams.abl_id;
end;
$$;

create or replace function public.bulk_upsert_players(rows jsonb)
returns table(id uuid, abl_id text)
language plpgsql
set search_path = public
as $$
begin
  return query
  insert into players (full_name, position, team_id, price, photo_url, abl_id, synced_at, archived_at)
  select
    r->>'full_name',
    r->>'position',
    (r->>'team_id')::uuid,
    (r->>'price')::integer,
    r->>'photo_url',
    r->>'abl_id',
    now(),
    null
  from jsonb_array_elements(rows) as r
  on conflict on constraint players_abl_id_key do update set
    full_name = excluded.full_name,
    position = excluded.position,
    team_id = excluded.team_id,
    photo_url = excluded.photo_url,
    synced_at = excluded.synced_at,
    archived_at = null
  returning players.id, players.abl_id;
end;
$$;

-- Архивного игрока нельзя добавить в состав.
create or replace function public.check_player_in_hall()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_hall uuid;
  v_player_hall uuid;
  v_player_archived timestamptz;
begin
  select p.hall_id into v_user_hall
  from fantasy_squads s
  join profiles p on p.id = s.user_id
  where s.id = new.squad_id;

  if v_user_hall is null then
    raise exception 'Сначала выберите зал';
  end if;

  select t.hall_id, pl.archived_at into v_player_hall, v_player_archived
  from players pl
  join teams t on t.id = pl.team_id
  where pl.id = new.player_id;

  if v_player_archived is not null then
    raise exception 'Игрок в архиве';
  end if;

  if v_player_hall is distinct from v_user_hall then
    raise exception 'Игрок не из вашего зала';
  end if;

  return new;
end;
$$;

-- Архивирует устаревшие команды и игроков. При p_dry_run = true только
-- считает, сколько записей будет затронуто.
--
-- Команда устарела, если её не обновляла синхронизация (synced_at пуст) или
-- последний раз это было более чем за 8 дней до самой свежей синхронизации
-- (цикл крона — неделя). Игрок устарел, если его команда устарела/в архиве,
-- он не синхронизировался, или его synced_at старше synced_at его команды
-- больше чем на час (т.е. при последнем импорте команды его в ростере не
-- было).
create or replace function public.admin_archive_stale(p_dry_run boolean default true)
returns table(teams_count integer, players_count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_latest timestamptz;
  v_teams integer;
  v_players integer;
begin
  if not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin
  ) then
    raise exception 'Forbidden';
  end if;

  select max(synced_at) into v_latest from teams;
  if v_latest is null then
    raise exception 'Нет синхронизированных команд: сначала выполните импорт из ABL';
  end if;

  select count(*) into v_players
  from players pl
  join teams t on t.id = pl.team_id
  where pl.archived_at is null
    and pl.abl_id is not null
    and (
      t.archived_at is not null
      or t.synced_at is null
      or t.synced_at < v_latest - interval '8 days'
      or pl.synced_at is null
      or pl.synced_at < t.synced_at - interval '1 hour'
    );

  select count(*) into v_teams
  from teams t
  where t.archived_at is null
    and t.abl_id is not null
    and (t.synced_at is null or t.synced_at < v_latest - interval '8 days');

  if not p_dry_run then
    update players pl set archived_at = now()
    from teams t
    where t.id = pl.team_id
      and pl.archived_at is null
      and pl.abl_id is not null
      and (
        t.archived_at is not null
        or t.synced_at is null
        or t.synced_at < v_latest - interval '8 days'
        or pl.synced_at is null
        or pl.synced_at < t.synced_at - interval '1 hour'
      );

    update teams t set archived_at = now()
    where t.archived_at is null
      and t.abl_id is not null
      and (t.synced_at is null or t.synced_at < v_latest - interval '8 days');
  end if;

  return query select v_teams, v_players;
end;
$$;

create or replace function public.admin_restore_archive()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin
  ) then
    raise exception 'Forbidden';
  end if;

  update players set archived_at = null where archived_at is not null;
  update teams set archived_at = null where archived_at is not null;
end;
$$;

revoke execute on function public.admin_archive_stale(boolean) from public, anon;
revoke execute on function public.admin_restore_archive() from public, anon;
grant execute on function public.admin_archive_stale(boolean) to authenticated;
grant execute on function public.admin_restore_archive() to authenticated;
