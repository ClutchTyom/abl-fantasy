import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegramInitData";

// Автовход из Telegram Mini App: проверяем подпись initData, находим
// привязанный аккаунт и отдаём одноразовый token_hash, который клиент
// обменивает на сессию через supabase.auth.verifyOtp.
export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Telegram-бот не настроен" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { initData?: unknown } | null;
  if (!body || typeof body.initData !== "string" || body.initData.length > 4096) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const telegramUser = verifyTelegramInitData(body.initData, botToken);
  if (!telegramUser) {
    return NextResponse.json({ error: "Подпись Telegram недействительна" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_user_id", telegramUser.id)
    .maybeSingle();
  if (linkError) {
    return NextResponse.json({ error: "Не удалось проверить привязку" }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: "Аккаунт не привязан" }, { status: 404 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(
    link.user_id
  );
  const email = userData?.user?.email;
  if (userError || !email) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const { data: linkData, error: generateError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (generateError || !tokenHash) {
    return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
  }

  return NextResponse.json({ tokenHash });
}
