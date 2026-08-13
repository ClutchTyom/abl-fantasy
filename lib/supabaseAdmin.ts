import { createClient } from "@supabase/supabase-js";

// ТОЛЬКО для серверного кода без пользовательской сессии (крон-джобы) —
// service role key полностью обходит RLS. Обычный supabase.ts (анонимный
// ключ) для этого не годится: там запись разрешена RLS-политиками только
// авторизованным (иногда только админам) пользователям, а у крона нет
// сессии залогиненного человека. НИКОГДА не импортировать этот файл из
// клиентского ("use client") кода — ключ не должен попасть в браузер.
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
