-- Экран управления админами: обычным пользователям email других не нужен
-- (и не должен быть виден — profiles читается всем авторизованным ради
-- рейтинга), поэтому список пользователей и переключение is_admin сделаны
-- через security definer функции, а не через прямой SELECT на profiles
-- или auth.users. Функция сама проверяет, что вызывающий — админ, и
-- отказывает всем остальным, независимо от того, что просит клиент.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  username text,
  email text,
  is_admin boolean,
  created_at timestamptz
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
    select p.id, p.username, u.email, p.is_admin, u.created_at
    from profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;

create or replace function public.admin_set_is_admin(target_user_id uuid, new_is_admin boolean)
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

  update profiles set is_admin = new_is_admin where profiles.id = target_user_id;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_is_admin(uuid, boolean) to authenticated;
