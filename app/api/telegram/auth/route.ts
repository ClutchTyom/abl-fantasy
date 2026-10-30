import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  telegramNickname,
  telegramTechnicalEmail,
  TelegramInitUser,
  verifyTelegramInitData,
  withTelegramIdSuffix,
} from "@/lib/telegramInitData";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// Находит привязанный аккаунт или, если его нет, создаёт новый из профиля
// Telegram (вход в Mini App без регистрации на сайте).
async function findOrCreateUserId(
  admin: AdminClient,
  telegramUser: TelegramInitUser
): Promise<string> {
  const { data: link, error: linkError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_user_id", telegramUser.id)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (link) return link.user_id;

  const nickname = telegramNickname(telegramUser);
  const { data: taken, error: takenError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", nickname)
    .maybeSingle();
  if (takenError) throw new Error(takenError.message);
  const username = taken ? withTelegramIdSuffix(nickname, telegramUser.id) : nickname;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: telegramTechnicalEmail(telegramUser.id),
    password: randomBytes(32).toString("base64url"),
    email_confirm: true,
    user_metadata: { username, created_via: "telegram_mini_app" },
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Не удалось создать аккаунт");
  }

  // В личном чате с ботом id чата совпадает с id пользователя Telegram.
  const { error: insertError } = await admin.from("telegram_links").insert({
    user_id: created.user.id,
    chat_id: telegramUser.id,
    telegram_user_id: telegramUser.id,
    username: telegramUser.username ?? null,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: preferencesError } = await admin
    .from("telegram_notification_preferences")
    .upsert({ user_id: created.user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (preferencesError) throw new Error(preferencesError.message);

  return created.user.id;
}

// Автовход из Telegram Mini App: проверяем подпись initData, находим (или
// создаём) аккаунт и отдаём одноразовый token_hash, который клиент
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

  let userId: string;
  try {
    userId = await findOrCreateUserId(admin, telegramUser);
  } catch (error) {
    console.error("[telegram/auth] findOrCreateUserId failed:", error);
    return NextResponse.json({ error: "Не удалось войти через Telegram" }, { status: 500 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
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
