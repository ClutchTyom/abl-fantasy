import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashTelegramLinkToken } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!supabaseUrl || !anonKey || !botUsername) {
    return NextResponse.json(
      { error: "Telegram-бот пока не настроен на сервере" },
      { status: 503 }
    );
  }

  if (!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) {
    return NextResponse.json(
      { error: "Некорректно задан TELEGRAM_BOT_USERNAME" },
      { status: 500 }
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Сессия истекла. Войдите снова." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existingLink, error: linkError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  if (existingLink) {
    return NextResponse.json(
      { error: "Сначала отключите прежнюю привязку командой /unlink в Telegram." },
      { status: 409 }
    );
  }

  const token = randomBytes(24).toString("base64url");
  const { error: insertError } = await admin
    .from("telegram_link_tokens")
    .insert({
      token_hash: hashTelegramLinkToken(token),
      user_id: authData.user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: cleanupError } = await admin
    .from("telegram_link_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) {
    return NextResponse.json({ error: cleanupError.message }, { status: 500 });
  }

  return NextResponse.json({
    link: `https://t.me/${botUsername}?start=${token}`,
  });
}
