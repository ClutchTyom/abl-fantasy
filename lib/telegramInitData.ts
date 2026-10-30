import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
};

// Ник для автоматически созданного аккаунта: username или имя из Telegram,
// только безопасные символы. Уникальность (profiles.username unique) решает
// вызывающий код через withTelegramIdSuffix.
export function telegramNickname(user: TelegramInitUser): string {
  const raw = user.username ?? user.first_name ?? "";
  const cleaned = raw.replace(/[^\p{L}\p{N}_ .-]/gu, "").trim().slice(0, 24);
  return cleaned || "Игрок";
}

export function withTelegramIdSuffix(nickname: string, telegramId: number): string {
  return `${nickname}_${telegramId}`;
}

export function telegramTechnicalEmail(telegramId: number): string {
  return `tg_${telegramId}@telegram-users.abl-fantasy.vercel.app`;
}

// Проверка подписи Telegram.WebApp.initData по документации Telegram:
// secret = HMAC_SHA256("WebAppData", botToken), hash = HMAC_SHA256(secret, data_check_string).
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
  nowSeconds = Math.floor(Date.now() / 1000)
): TelegramInitUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramInitUser;
    return typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
