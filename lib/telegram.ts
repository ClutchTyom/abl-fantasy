import { createHash } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramButton = {
  text: string;
  url?: string;
  web_app?: { url: string };
};

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  buttons?: TelegramButton[][]
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });

  const result = (await response.json()) as {
    ok: boolean;
    description?: string;
  };
  if (!response.ok || !result.ok) {
    throw new Error(result.description ?? `Telegram API returned ${response.status}`);
  }
}

export function telegramWebAppUrl(path = "/team"): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;

  const url = new URL(path, siteUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS");
  }
  return url.toString();
}

export function hashTelegramLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
