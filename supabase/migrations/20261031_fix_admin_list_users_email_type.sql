-- auth.users.email — varchar(255), а admin_list_users объявляла колонку как
-- text: plpgsql строго сверяет типы возвращаемых колонок, и вызов падал с
-- "structure of query does not match function result type". Явно приводим
-- email к text.
create or replace function public.admin_list_users()
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
    select p.id, p.username, u.email::text, p.is_admin, u.created_at, p.hall_id
    from profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc;
end;
$$;
