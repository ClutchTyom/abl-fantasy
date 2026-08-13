-- Массовый upsert для teams/players за один запрос вместо select+insert/
-- update на каждую строку в цикле синхронизации ABL. short_name (teams) и
-- price (players) сознательно НЕ входят в SET при конфликте — их может
-- менять администратор вручную или пересчёт цен, и повторная
-- синхронизация не должна их затирать (как и раньше в поштучной версии).
-- Обычный supabase-js .upsert() не умеет "обновить один набор полей, а
-- другой оставить как есть" в одном массовом запросе, поэтому это делает
-- SQL-функция с явным ON CONFLICT ... DO UPDATE SET.
--
-- security invoker (по умолчанию, без security definer) — функции
-- выполняются с правами вызывающего, так что действующие RLS-политики на
-- teams/players продолжают решать, кому можно писать, как и раньше.
--
-- ON CONFLICT указан по имени constraint, а не списком колонок (abl_id):
-- RETURNS TABLE(id, abl_id) объявляет id/abl_id внутренними переменными
-- функции, и голое имя "abl_id" в "on conflict (abl_id)" становится
-- неоднозначным — Postgres не понимает, колонка это или переменная.
-- Ссылка на constraint по имени эту неоднозначность обходит.

create or replace function public.bulk_upsert_teams(rows jsonb)
returns table(id uuid, abl_id text)
language plpgsql
as $$
begin
  return query
  insert into teams (name, short_name, division, logo_url, abl_id)
  select
    r->>'name',
    r->>'short_name',
    r->>'division',
    r->>'logo_url',
    r->>'abl_id'
  from jsonb_array_elements(rows) as r
  on conflict on constraint teams_abl_id_key do update set
    name = excluded.name,
    division = excluded.division,
    logo_url = excluded.logo_url
  returning teams.id, teams.abl_id;
end;
$$;

create or replace function public.bulk_upsert_players(rows jsonb)
returns table(id uuid, abl_id text)
language plpgsql
as $$
begin
  return query
  insert into players (full_name, position, team_id, price, photo_url, abl_id)
  select
    r->>'full_name',
    r->>'position',
    (r->>'team_id')::uuid,
    (r->>'price')::integer,
    r->>'photo_url',
    r->>'abl_id'
  from jsonb_array_elements(rows) as r
  on conflict on constraint players_abl_id_key do update set
    full_name = excluded.full_name,
    position = excluded.position,
    team_id = excluded.team_id,
    photo_url = excluded.photo_url
  returning players.id, players.abl_id;
end;
$$;

grant execute on function public.bulk_upsert_teams(jsonb) to authenticated;
grant execute on function public.bulk_upsert_players(jsonb) to authenticated;
