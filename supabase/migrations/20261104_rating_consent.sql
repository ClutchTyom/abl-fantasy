-- Отдельное согласие на распространение никнейма и результатов в общем
-- рейтинге (ст. 10.1 152-ФЗ, раздел 4 политики). Согласие даётся отдельно от
-- обычного согласия на обработку (privacy_consent_at) и по умолчанию не дано.

-- ===== Часть A: колонка, функции, регистрация =====

alter table public.profiles add column if not exists rating_consent_at timestamptz;

grant update (rating_consent_at) on public.profiles to authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

revoke execute on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

-- Единственный путь к чужим профилям: ник отдаётся только тем, кто дал
-- согласие на распространение, остальные приходят с display_name = null.
create or replace function public.public_profiles(
  p_ids uuid[] default null,
  p_hall_id uuid default null
)
returns table (id uuid, display_name text, hall_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    case when p.rating_consent_at is not null then p.username end,
    p.hall_id
  from public.profiles p
  where (p_ids is null or p.id = any(p_ids))
    and (p_hall_id is null or p.hall_id = p_hall_id)
$$;

revoke execute on function public.public_profiles(uuid[], uuid) from public, anon;
grant execute on function public.public_profiles(uuid[], uuid) to authenticated;

-- При регистрации на сайте согласие на рейтинг передаётся в метаданных
-- (галочка на форме, по умолчанию выключена).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, privacy_consent_at, rating_consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    (new.raw_user_meta_data->>'privacy_consent_at')::timestamptz,
    (new.raw_user_meta_data->>'rating_consent_at')::timestamptz
  );
  return new;
end;
$$;

-- ===== Часть B: закрыть прямое чтение чужих профилей =====
-- Применять ПОСЛЕ выкладки кода, который читает рейтинг через public_profiles.

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "read own profile" on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  as permissive for select to authenticated
  using (id = auth.uid() or public.is_admin_user());
