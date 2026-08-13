import { NextRequest, NextResponse } from "next/server";
import { syncAblTournament, SyncSummary } from "@/lib/abl/sync";
import { ABL_DIVISIONS } from "@/lib/abl/client";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

// Даём фоновой синхронизации максимум времени, которое разрешит план
// Vercel (Hobby всё равно урежет до своего потолка) — 13 дивизионов
// подряд вполне может не уложиться в 60 секунд Hobby-плана, тогда крон
// оборвётся на середине списка. Это не страшно: bulk upsert идемпотентен,
// а следующий еженедельный запуск просто продолжит обновлять то же самое.
export const maxDuration = 300;

// Vercel сам добавляет "Authorization: Bearer <CRON_SECRET>" к запросам
// от Cron Jobs, если в проекте задана переменная окружения CRON_SECRET —
// сверяем её, чтобы этот эндпоинт не мог дёрнуть кто угодно по URL.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  const results: { alias: string; label: string; summary?: SyncSummary; error?: string }[] = [];

  for (const division of ABL_DIVISIONS) {
    try {
      const summary = await syncAblTournament(division.alias, undefined, client);
      results.push({ alias: division.alias, label: division.label, summary });
    } catch (err) {
      results.push({
        alias: division.alias,
        label: division.label,
        error: err instanceof Error ? err.message : "Неизвестная ошибка",
      });
    }
  }

  return NextResponse.json({ results });
}
