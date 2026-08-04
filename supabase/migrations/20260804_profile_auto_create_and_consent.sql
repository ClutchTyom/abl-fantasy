-- Раньше строка profiles создавалась отдельным клиентским запросом сразу
-- после auth.signUp(). Это ломается при включённом подтверждении почты:
-- пока пользователь не подтвердил email, активной сессии нет, и запрос от
-- анонимного клиента с произвольным id в RLS не пройдёт. Стандартный
-- паттерн Supabase — триггер на auth.users, который создаёт profiles
-- независимо от того, есть ли у клиента сессия. Заодно убирает риск
-- "аккаунт есть, а профиля нет", если клиентский insert раньше падал.

alter table profiles add column if not exists privacy_consent_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, privacy_consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    (new.raw_user_meta_data->>'privacy_consent_at')::timestamptz
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
