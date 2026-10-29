import { NextRequest, NextResponse } from "next/server";
import { syncAblTournament, SyncSummary } from "@/lib/abl/sync";
import { ABL_DIVISIONS } from "@/lib/abl/client";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { decideAutoArchive } from "@/lib/archiveGuard";

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

  const archive = await archiveStaleAfterSync(
    client,
    results.filter((r) => r.error).length
  );

  return NextResponse.json({ results, archive });
}

type ArchiveReport =
  | { archived: { teams: number; players: number } }
  | { skipped: string }
  | { error: string };

// После полного синка архивируем команды и игроков, которых он не обновил
// (см. archive_stale в миграциях). Предохранитель в lib/archiveGuard.ts не
// даёт архивировать ничего при ошибках синка или подозрительно большом
// объёме; любая ошибка здесь не должна ломать ответ самого синка.
async function archiveStaleAfterSync(
  client: ReturnType<typeof createSupabaseAdminClient>,
  syncErrors: number
): Promise<ArchiveReport> {
  try {
    const { data: dryRun, error: dryRunError } = await client.rpc("archive_stale", {
      p_dry_run: true,
    });
    if (dryRunError) return { error: dryRunError.message };

    const planned = (dryRun as { teams_count: number; players_count: number }[] | null)?.[0];
    if (!planned) return { error: "archive_stale не вернула данные" };

    const [activeTeams, activePlayers] = await Promise.all([
      client
        .from("teams")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("abl_id", "is", null),
      client
        .from("players")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("abl_id", "is", null),
    ]);
    if (activeTeams.error || activePlayers.error) {
      return { error: (activeTeams.error ?? activePlayers.error)!.message };
    }

    const decision = decideAutoArchive({
      syncErrors,
      toArchive: { teams: planned.teams_count, players: planned.players_count },
      active: { teams: activeTeams.count ?? 0, players: activePlayers.count ?? 0 },
    });
    if (!decision.archive) return { skipped: decision.reason };

    const { data: done, error: archiveError } = await client.rpc("archive_stale", {
      p_dry_run: false,
    });
    if (archiveError) return { error: archiveError.message };

    const result = (done as { teams_count: number; players_count: number }[] | null)?.[0];
    return {
      archived: { teams: result?.teams_count ?? 0, players: result?.players_count ?? 0 },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Неизвестная ошибка архивации" };
  }
}
