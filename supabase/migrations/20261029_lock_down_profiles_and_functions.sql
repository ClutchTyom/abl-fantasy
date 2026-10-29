-- Критичная дыра: политика "update own profile" разрешала владельцу строки
-- UPDATE без ограничений по колонкам, а у ролей anon/authenticated было
-- право UPDATE на profiles.is_admin. Любой залогиненный пользователь мог
-- выполнить supabase.from('profiles').update({ is_admin: true }) для своей
-- строки и получить полный доступ ко всем "admins manage ..." политикам.
--
-- Режем на уровне прав на колонки: клиент может менять только безопасные
-- поля. is_admin по-прежнему переключается через security definer функцию
-- admin_set_is_admin (она сама проверяет, что вызывающий — админ).
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url, privacy_consent_at) on public.profiles to authenticated;

-- Админские RPC не должны вызываться анонимно (внутри всё равно стоит
-- проверка is_admin, но лишняя поверхность атаки ни к чему).
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_set_is_admin(uuid, boolean) from public, anon;

-- Триггерная функция создания профиля не предназначена для вызова через
-- /rest/v1/rpc — её запускает только триггер на auth.users.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Фиксируем search_path у функций, у которых он не задан.
alter function public.check_single_captain() set search_path = public;
alter function public.check_round_not_locked() set search_path = public;
alter function public.check_squad_constraints() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.bulk_upsert_players(jsonb) set search_path = public;
alter function public.bulk_upsert_teams(jsonb) set search_path = public;
