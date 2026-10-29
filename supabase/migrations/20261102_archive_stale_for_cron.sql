-- Автоархивация после недельного cron-синка (/api/cron/sync). Крон работает
-- с service role без пользователя, а admin_archive_stale проверяет auth.uid(),
-- поэтому логика вынесена во внутреннюю archive_stale() — её может вызвать
-- только service_role. admin_archive_stale остаётся для админки и теперь
-- просто проверяет права и вызывает её.

create or replace function public.archive_stale(p_dry_run boolean default true)
returns table(teams_count integer, players_count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_latest timestamptz;
  v_teams integer;
  v_players integer;
begin
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

revoke execute on function public.archive_stale(boolean) from public, anon, authenticated;
grant execute on function public.archive_stale(boolean) to service_role;

create or replace function public.admin_archive_stale(p_dry_run boolean default true)
returns table(teams_count integer, players_count integer)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin
  ) then
    raise exception 'Forbidden';
  end if;

  return query select * from public.archive_stale(p_dry_run);
end;
$$;
