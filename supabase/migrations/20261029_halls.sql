-- Залы: в каждом зале играет 4-6 дивизионов, рейтинг считается внутри зала,
-- а игрок выбирает зал один раз на сезон и собирает состав только из
-- игроков дивизионов этого зала.

create table if not exists public.halls (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort integer not null default 0
);

alter table public.halls enable row level security;

drop policy if exists "halls_select_all" on public.halls;
create policy "halls_select_all" on public.halls for select using (true);

insert into public.halls (slug, name, sort) values
  ('moskvich', 'Москвич', 1),
  ('profa', 'Профа', 2),
  ('shelepiha', 'Шелепиха', 3),
  ('perovo', 'Перово', 4),
  ('pure', 'PURE', 5),
  ('wbl', 'WBL', 6)
on conflict (slug) do nothing;

-- Зал команды выставляет синхронизация с ABL (по алиасу турнира).
alter table public.teams add column if not exists hall_id uuid references public.halls(id);
create index if not exists teams_hall_id_idx on public.teams(hall_id);

-- Выбранный зал игрока. Клиент не имеет права UPDATE на эту колонку
-- (см. 20261029_lock_down_profiles_and_functions.sql) — только через RPC.
alter table public.profiles add column if not exists hall_id uuid references public.halls(id);
create index if not exists profiles_hall_id_idx on public.profiles(hall_id);

-- Игрок выбирает зал один раз; сменить его может только админ.
create or replace function public.join_hall(p_hall_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;

  if not exists (select 1 from halls where id = p_hall_id) then
    raise exception 'Зал не найден';
  end if;

  update profiles set hall_id = p_hall_id
  where id = auth.uid() and hall_id is null;

  if not found then
    raise exception 'Зал уже выбран. Сменить его может только администратор.';
  end if;
end;
$$;

create or replace function public.admin_set_user_hall(target_user_id uuid, new_hall_id uuid)
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

  update profiles set hall_id = new_hall_id where profiles.id = target_user_id;
end;
$$;

revoke execute on function public.join_hall(uuid) from public, anon;
revoke execute on function public.admin_set_user_hall(uuid, uuid) from public, anon;
grant execute on function public.join_hall(uuid) to authenticated;
grant execute on function public.admin_set_user_hall(uuid, uuid) to authenticated;

-- admin_list_users теперь отдаёт и зал каждого пользователя.
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid,
  username text,
  email text,
  is_admin boolean,
  created_at timestamptz,
  hall_id uuid
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin
  ) then
    raise exception 'Forbidden';
  end if;

  return query
    select p.id, p.username, u.email, p.is_admin, u.created_at, p.hall_id
    from profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Жёсткая проверка на уровне базы: в состав можно добавить только игрока из
-- зала владельца состава. Клиентский фильтр — лишь удобство.
create or replace function public.check_player_in_hall()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_hall uuid;
  v_player_hall uuid;
begin
  select p.hall_id into v_user_hall
  from fantasy_squads s
  join profiles p on p.id = s.user_id
  where s.id = new.squad_id;

  if v_user_hall is null then
    raise exception 'Сначала выберите зал';
  end if;

  select t.hall_id into v_player_hall
  from players pl
  join teams t on t.id = pl.team_id
  where pl.id = new.player_id;

  if v_player_hall is distinct from v_user_hall then
    raise exception 'Игрок не из вашего зала';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_player_in_hall() from public, anon, authenticated;

drop trigger if exists trg_player_in_hall on public.fantasy_squad_players;
create trigger trg_player_in_hall
  before insert or update of player_id on public.fantasy_squad_players
  for each row execute function public.check_player_in_hall();

-- bulk_upsert_teams теперь принимает hall_slug и проставляет teams.hall_id.
-- Если у строки зала нет (hall_slug не передан), прежний зал команды
-- сохраняется.
create or replace function public.bulk_upsert_teams(rows jsonb)
returns table(id uuid, abl_id text)
language plpgsql
set search_path = public
as $$
begin
  return query
  insert into teams (name, short_name, division, logo_url, abl_id, hall_id)
  select
    r->>'name',
    r->>'short_name',
    r->>'division',
    r->>'logo_url',
    r->>'abl_id',
    (select h.id from halls h where h.slug = r->>'hall_slug')
  from jsonb_array_elements(rows) as r
  on conflict on constraint teams_abl_id_key do update set
    name = excluded.name,
    division = excluded.division,
    logo_url = excluded.logo_url,
    hall_id = coalesce(excluded.hall_id, teams.hall_id)
  returning teams.id, teams.abl_id;
end;
$$;
