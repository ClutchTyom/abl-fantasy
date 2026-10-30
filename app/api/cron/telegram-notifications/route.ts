import { NextRequest, NextResponse } from "next/server";
import { computeAllSquadResults } from "@/lib/squadPoints";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 60;

type Preference = {
  user_id: string;
  lock_reminder: boolean;
  round_results: boolean;
  match_schedule: boolean;
};

type LinkedUser = { user_id: string; chat_id: number };

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function moscowDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendOnce(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  eventKey: string,
  user: LinkedUser,
  text: string
): Promise<boolean> {
  const { error: claimError } = await admin
    .from("telegram_notification_deliveries")
    .insert({ event_key: eventKey, user_id: user.user_id, chat_id: user.chat_id });
  if (claimError?.code === "23505") return false;
  if (claimError) throw new Error(`Не удалось зарезервировать уведомление: ${claimError.message}`);

  try {
    await sendTelegramMessage(user.chat_id, text);
  } catch (error) {
    const { error: deleteError } = await admin
      .from("telegram_notification_deliveries")
      .delete()
      .eq("event_key", eventKey)
      .eq("user_id", user.user_id);
    if (deleteError) {
      throw new Error(
        `Не удалось отправить уведомление (${String(error)}) и удалить резерв (${deleteError.message})`
      );
    }
    throw error;
  }

  const { error: updateError } = await admin
    .from("telegram_notification_deliveries")
    .update({ sent_at: new Date().toISOString() })
    .eq("event_key", eventKey)
    .eq("user_id", user.user_id);
  if (updateError) throw new Error(`Не удалось отметить уведомление отправленным: ${updateError.message}`);
  return true;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: preferences, error: preferencesError } = await admin
    .from("telegram_notification_preferences")
    .select("user_id, lock_reminder, round_results, match_schedule");
  if (preferencesError) {
    return NextResponse.json({ error: preferencesError.message }, { status: 500 });
  }

  const optedIn = (preferences ?? []) as Preference[];
  if (!optedIn.some((preference) =>
    preference.lock_reminder || preference.round_results || preference.match_schedule
  )) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: links, error: linksError } = await admin
    .from("telegram_links")
    .select("user_id, chat_id");
  if (linksError) {
    return NextResponse.json({ error: linksError.message }, { status: 500 });
  }

  const userById = new Map(
    ((links ?? []) as LinkedUser[]).map((user) => [user.user_id, user])
  );
  const activePreferences = optedIn
    .map((preference) => ({
      preference,
      user: userById.get(preference.user_id),
    }))
    .filter(
      (row): row is { preference: Preference; user: LinkedUser } => Boolean(row.user)
    );

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let sent = 0;
  const errors: string[] = [];

  const { data: weeks, error: weeksError } = await admin
    .from("fantasy_weeks")
    .select("id, starts_at, ends_at")
    .gt("starts_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lte("starts_at", tomorrow.toISOString());
  if (weeksError) {
    return NextResponse.json({ error: weeksError.message }, { status: 500 });
  }

  for (const week of weeks ?? []) {
    for (const row of activePreferences.filter((item) => item.preference.lock_reminder)) {
      try {
        sent += Number(await sendOnce(
          admin,
          `lock:${week.id}`,
          row.user,
          new Date(week.starts_at).getTime() <= now.getTime()
            ? `Блокировка состава на этот тур уже произошла: ${moscowDate(week.starts_at)} (МСК).`
            : `Напоминание: состав на новый тур блокируется ${moscowDate(week.starts_at)} (МСК).`
        ));
      } catch (error) {
        errors.push(String(error));
      }
    }
  }

  const { data: matches, error: matchesError } = await admin
    .from("matches")
    .select(
      "id, starts_at, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
    )
    .gte("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString())
    .eq("status", "scheduled");
  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 });
  }

  for (const match of matches ?? []) {
    const home = match.home_team as unknown as { name: string } | null;
    const away = match.away_team as unknown as { name: string } | null;
    for (const row of activePreferences.filter((item) => item.preference.match_schedule)) {
      try {
        sent += Number(await sendOnce(
          admin,
          `match:${match.id}`,
          row.user,
          `Матч ABL: ${home?.name ?? "?"} – ${away?.name ?? "?"}, ${moscowDate(match.starts_at)} (МСК).`
        ));
      } catch (error) {
        errors.push(String(error));
      }
    }
  }

  const resultsCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { data: endedWeeks, error: endedWeeksError } = await admin
    .from("fantasy_weeks")
    .select("id, starts_at")
    .lte("ends_at", resultsCutoff.toISOString());
  if (endedWeeksError) {
    return NextResponse.json({ error: endedWeeksError.message }, { status: 500 });
  }

  if ((endedWeeks ?? []).length && activePreferences.some((row) => row.preference.round_results)) {
    const results = await computeAllSquadResults(admin);
    for (const week of endedWeeks ?? []) {
      const ranked = results
        .filter((result) => result.weekId === week.id)
        .sort((a, b) => b.totalPoints - a.totalPoints);
      for (const row of activePreferences.filter((item) => item.preference.round_results)) {
        const place = ranked.findIndex((result) => result.userId === row.user.user_id) + 1;
        const result = ranked.find((entry) => entry.userId === row.user.user_id);
        const text = result
          ? `Итоги тура: ${result.totalPoints.toFixed(1)} FP, место ${place} из ${ranked.length}.`
          : "Тур завершён. В этом туре у вас не было сохранённого состава.";
        try {
          sent += Number(await sendOnce(admin, `results:${week.id}`, row.user, text));
        } catch (error) {
          errors.push(String(error));
        }
      }
    }
  }

  return NextResponse.json({ sent, errors }, { status: errors.length ? 500 : 200 });
}
