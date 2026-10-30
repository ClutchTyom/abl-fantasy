import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { computeAllSquadResults } from "@/lib/squadPoints";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { publicDisplayName } from "@/lib/ratingConsent";
import {
  hashTelegramLinkToken,
  sendTelegramMessage,
  telegramWebAppUrl,
  TelegramButton,
} from "@/lib/telegram";

type TelegramMessage = {
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; username?: string };
};

type TelegramUpdate = { message?: TelegramMessage };

function isValidSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const actualBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

function webAppButtons(): TelegramButton[][] | undefined {
  const url = telegramWebAppUrl("/team");
  return url ? [[{ text: "Открыть ABL Fantasy", web_app: { url } }]] : undefined;
}

async function linkTelegramAccount(
  message: TelegramMessage,
  token: string
): Promise<void> {
  if (!message.from) {
    await sendTelegramMessage(message.chat.id, "Не удалось определить Telegram-аккаунт.");
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: linkToken, error: tokenError } = await admin
    .from("telegram_link_tokens")
    .select("token_hash, user_id")
    .eq("token_hash", hashTelegramLinkToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenError) throw new Error(`Не удалось проверить ссылку: ${tokenError.message}`);
  if (!linkToken) {
    await sendTelegramMessage(
      message.chat.id,
      "Ссылка недействительна или устарела. Создайте новую на сайте."
    );
    return;
  }

  const { data: existingUserLink, error: existingUserError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("user_id", linkToken.user_id)
    .maybeSingle();
  if (existingUserError) throw new Error(existingUserError.message);
  if (existingUserLink) {
    await sendTelegramMessage(
      message.chat.id,
      "К этому аккаунту уже привязан Telegram. Сначала отключите прежнюю привязку командой /unlink."
    );
    return;
  }

  const { data: existingTelegramLink, error: existingTelegramError } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_user_id", message.from.id)
    .maybeSingle();
  if (existingTelegramError) throw new Error(existingTelegramError.message);
  if (existingTelegramLink) {
    await sendTelegramMessage(
      message.chat.id,
      "Этот Telegram уже привязан к другому аккаунту сайта. Отключите её командой /unlink."
    );
    return;
  }

  const { error: insertError } = await admin.from("telegram_links").insert({
    user_id: linkToken.user_id,
    chat_id: message.chat.id,
    telegram_user_id: message.from.id,
    username: message.from.username ?? null,
  });
  if (insertError) throw new Error(`Не удалось привязать аккаунт: ${insertError.message}`);

  const { error: preferencesError } = await admin
    .from("telegram_notification_preferences")
    .upsert({ user_id: linkToken.user_id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (preferencesError) throw new Error(preferencesError.message);

  const { error: deleteError } = await admin
    .from("telegram_link_tokens")
    .delete()
    .eq("token_hash", linkToken.token_hash);
  if (deleteError) throw new Error(deleteError.message);

  await sendTelegramMessage(
    message.chat.id,
    "Аккаунт ABL Fantasy успешно привязан. Команда /me покажет ваши результаты, а /notify включит уведомления.",
    webAppButtons()
  );
}

async function handleCommand(message: TelegramMessage, text: string) {
  const [rawCommand, argument] = text.trim().split(/\s+/, 2);
  const command = rawCommand.split("@")[0].toLowerCase();
  const admin = createSupabaseAdminClient();

  if (command === "/start" && argument) {
    await linkTelegramAccount(message, argument);
    return;
  }

  if (command === "/start" || command === "/help") {
    await sendTelegramMessage(
      message.chat.id,
      [
        "ABL Fantasy — fantasy-лига по баскетболу ABL.",
        "",
        "/schedule — ближайшие матчи",
        "/rating — общий рейтинг",
        "/teams — команды лиги",
        "/players — игроки лиги",
        "/rules — правила игры",
        "/me — ваши результаты (после привязки)",
        "/notify — включить все уведомления",
        "/stop — отключить уведомления",
        "/unlink — отвязать аккаунт",
      ].join("\n"),
      webAppButtons()
    );
    return;
  }

  if (command === "/app") {
    const buttons = webAppButtons();
    await sendTelegramMessage(
      message.chat.id,
      buttons ? "Откройте приложение ABL Fantasy:" : "Откройте сайт ABL Fantasy.",
      buttons
    );
    return;
  }

  if (command === "/rules") {
    await sendTelegramMessage(
      message.chat.id,
      "Соберите состав из 10 игроков с бюджетом 100. Капитан получает двойные очки; состав блокируется в субботу в 09:00 по Москве. Подробные правила — на сайте."
    );
    return;
  }

  if (command === "/teams") {
    const { data, error } = await admin
      .from("teams")
      .select("name, division")
      .order("name")
      .limit(30);
    if (error) throw new Error(`Не удалось загрузить команды: ${error.message}`);
    await sendTelegramMessage(
      message.chat.id,
      data?.length
        ? `Команды ABL:\n${data.map((team) => `${team.name}${team.division ? ` — ${team.division}` : ""}`).join("\n")}`
        : "Пока нет данных о командах."
    );
    return;
  }

  if (command === "/players") {
    const { data, error } = await admin
      .from("players")
      .select("full_name, position, price, teams(name)")
      .order("price", { ascending: false })
      .limit(15);
    if (error) throw new Error(`Не удалось загрузить игроков: ${error.message}`);
    const lines = (data ?? []).map((player) => {
      const team = player.teams as unknown as { name: string } | null;
      return `${player.full_name} (${player.position}) — ${team?.name ?? "без команды"}, ${player.price}`;
    });
    await sendTelegramMessage(
      message.chat.id,
      lines.length ? `Игроки по цене:\n${lines.join("\n")}` : "Пока нет данных об игроках."
    );
    return;
  }

  if (command === "/schedule") {
    const { data, error } = await admin
      .from("matches")
      .select(
        "starts_at, status, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)"
      )
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5);
    if (error) throw new Error(`Не удалось загрузить расписание: ${error.message}`);

    const lines = (data ?? []).map((match) => {
      const home = match.home_team as unknown as { name: string } | null;
      const away = match.away_team as unknown as { name: string } | null;
      const date = new Date(match.starts_at).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${date} — ${home?.name ?? "?"} – ${away?.name ?? "?"}`;
    });

    await sendTelegramMessage(
      message.chat.id,
      lines.length ? `Ближайшие матчи (МСК):\n${lines.join("\n")}` : "В расписании пока нет ближайших матчей."
    );
    return;
  }

  if (command === "/rating") {
    const results = await computeAllSquadResults(admin);
    const totals = new Map<string, number>();
    for (const result of results) {
      totals.set(result.userId, (totals.get(result.userId) ?? 0) + result.totalPoints);
    }

    const users = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!users.length) {
      await sendTelegramMessage(message.chat.id, "Рейтинг появится после первых результатов тура.");
      return;
    }

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, username, rating_consent_at")
      .in("id", users.map(([userId]) => userId));
    if (error) throw new Error(`Не удалось загрузить рейтинг: ${error.message}`);
    // Ник публикуется только при отдельном согласии на распространение.
    const names = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        publicDisplayName(profile.username, Boolean(profile.rating_consent_at)),
      ])
    );
    await sendTelegramMessage(
      message.chat.id,
      `Общий рейтинг:\n${users
        .map(([userId, points], index) => `${index + 1}. ${names.get(userId) ?? publicDisplayName(null, false)} — ${points.toFixed(1)} FP`)
        .join("\n")}`
    );
    return;
  }

  if (command === "/me") {
    const { data: link, error } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_user_id", message.from?.id ?? -1)
      .maybeSingle();
    if (error) throw new Error(`Не удалось проверить привязку: ${error.message}`);
    if (!link) {
      await sendTelegramMessage(message.chat.id, "Сначала привяжите аккаунт на сайте через страницу Telegram.");
      return;
    }

    const results = await computeAllSquadResults(admin);
    const completed = results
      .filter(
        (result) =>
          result.userId === link.user_id &&
          new Date(result.weekEndsAt).getTime() <= Date.now()
      )
      .sort((a, b) => b.weekStartsAt.localeCompare(a.weekStartsAt));
    const latest = completed[0];
    let response = latest
      ? `Последний завершённый тур: ${latest.totalPoints.toFixed(1)} FP`
      : "Завершённых туров пока нет.";

    if (latest) {
      const weeklyRank = results
        .filter((result) => result.weekId === latest.weekId)
        .sort((a, b) => b.totalPoints - a.totalPoints);
      const place = weeklyRank.findIndex((result) => result.userId === link.user_id) + 1;
      if (place) response += `, место ${place} из ${weeklyRank.length}`;
    }

    const { data: squads, error: squadsError } = await admin
      .from("fantasy_squads")
      .select("id, fantasy_weeks(starts_at, ends_at)")
      .eq("user_id", link.user_id);
    if (squadsError) throw new Error(`Не удалось загрузить ваш состав: ${squadsError.message}`);

    const now = Date.now();
    const weekRows = (squads ?? []) as unknown as {
      id: string;
      fantasy_weeks: { starts_at: string; ends_at: string } | null;
    }[];
    const currentSquad =
      weekRows
        .filter(
          (squad) =>
            squad.fantasy_weeks &&
            new Date(squad.fantasy_weeks.starts_at).getTime() <= now &&
            new Date(squad.fantasy_weeks.ends_at).getTime() > now
        )
        .sort((a, b) =>
          a.fantasy_weeks!.starts_at.localeCompare(b.fantasy_weeks!.starts_at)
        )[0] ??
      weekRows
        .filter(
          (squad) =>
            squad.fantasy_weeks &&
            new Date(squad.fantasy_weeks.starts_at).getTime() > now
        )
        .sort((a, b) =>
          a.fantasy_weeks!.starts_at.localeCompare(b.fantasy_weeks!.starts_at)
        )[0];

    if (currentSquad) {
      const { data: squadPlayers, error: squadPlayersError } = await admin
        .from("fantasy_squad_players")
        .select("player_id, is_captain")
        .eq("squad_id", currentSquad.id);
      if (squadPlayersError) throw new Error(squadPlayersError.message);

      const playerIds = (squadPlayers ?? []).map((player) => player.player_id);
      const { data: players, error: playersError } = playerIds.length
        ? await admin
            .from("players")
            .select("id, full_name")
            .in("id", playerIds)
        : { data: [], error: null };
      if (playersError) throw new Error(playersError.message);
      const names = new Map((players ?? []).map((player) => [player.id, player.full_name]));
      const roster = (squadPlayers ?? []).map(
        (player) =>
          `${player.is_captain ? "★ " : ""}${names.get(player.player_id) ?? "Игрок"}`
      );
      response += `\n\nВаш состав:\n${roster.length ? roster.join("\n") : "Пока не заполнен."}`;
    } else {
      response += "\n\nСостав на активный тур ещё не сохранён.";
    }

    await sendTelegramMessage(message.chat.id, response);
    return;
  }

  if (command === "/notify" || command === "/stop") {
    const { data: link, error } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_user_id", message.from?.id ?? -1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link) {
      await sendTelegramMessage(message.chat.id, "Сначала привяжите аккаунт на сайте.");
      return;
    }

    const enabled = command === "/notify";
    const { error: preferenceError } = await admin
      .from("telegram_notification_preferences")
      .upsert(
        {
          user_id: link.user_id,
          lock_reminder: enabled,
          round_results: enabled,
          match_schedule: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (preferenceError) throw new Error(preferenceError.message);
    await sendTelegramMessage(
      message.chat.id,
      enabled
        ? "Уведомления включены: блокировка состава, матчи в ближайшие 48 часов и результаты туров. Отключить можно командой /stop."
        : "Уведомления отключены."
    );
    return;
  }

  if (command === "/unlink") {
    const { data: link, error } = await admin
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_user_id", message.from?.id ?? -1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link) {
      await sendTelegramMessage(message.chat.id, "Аккаунт не привязан.");
      return;
    }

    const { error: preferencesError } = await admin
      .from("telegram_notification_preferences")
      .upsert(
        {
          user_id: link.user_id,
          lock_reminder: false,
          round_results: false,
          match_schedule: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (preferencesError) throw new Error(preferencesError.message);

    const { error: deleteError } = await admin
      .from("telegram_links")
      .delete()
      .eq("user_id", link.user_id);
    if (deleteError) throw new Error(`Не удалось отвязать аккаунт: ${deleteError.message}`);
    await sendTelegramMessage(message.chat.id, "Аккаунт отвязан. Вы можете удалить этот чат.");
    return;
  }

  await sendTelegramMessage(message.chat.id, "Неизвестная команда. Отправьте /help для списка команд.");
}

export async function POST(request: NextRequest) {
  if (!isValidSecret(
    request.headers.get("x-telegram-bot-api-secret-token"),
    process.env.TELEGRAM_WEBHOOK_SECRET
  )) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  const message = update.message;
  if (!message || message.chat.type !== "private" || !message.text) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleCommand(message, message.text);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook failed:", error);
    return NextResponse.json({ error: "Не удалось обработать сообщение" }, { status: 500 });
  }
}
