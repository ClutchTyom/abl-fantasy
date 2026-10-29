import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedAblPath } from "@/lib/abl/allowedPaths";

const ABL_BASE_URL = "https://mtgame.ru/api/v1";

// mtgame.ru (бэкенд ABL) разрешает браузерные запросы (CORS) только со
// своих доменов и localhost — с боевого домена на Vercel запрос браузером
// напрямую падает ("Failed to fetch"). CORS — ограничение только для
// браузера, поэтому проксируем через собственный сервер: серверный fetch
// никаких CORS-ограничений не имеет, а браузер обращается уже к своему же
// домену.
//
// Прокси не должен быть открытым: им пользуется только админский импорт,
// поэтому пускаем лишь вошедших админов (Bearer-токен сессии Supabase) и
// только разрешённые пути (см. lib/abl/allowedPaths.ts).
async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !anonKey) return false;

  // Клиент работает от имени пользователя, так что is_admin читается через
  // обычный RLS — service role для этого не нужен.
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await client.auth.getUser(accessToken);
  if (authError || !authData.user) return false;

  const { data: profile } = await client
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.user.id)
    .maybeSingle();

  return profile?.is_admin === true;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const path = request.nextUrl.searchParams.get("path");

  if (!isAllowedAblPath(path)) {
    return NextResponse.json(
      { error: "Query param 'path' is missing or not allowed" },
      { status: 400 }
    );
  }

  const res = await fetch(`${ABL_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
