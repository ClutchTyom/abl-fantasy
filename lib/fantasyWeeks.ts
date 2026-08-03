import { supabase } from "@/lib/supabaseClient";

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type FantasyWeek = {
  id: string;
  starts_at: string;
  ends_at: string;
};

// Следующая субота 09:00 по Москве (строго в будущем относительно `from`).
// Все дивизионы ABL играют по выходным, so эта отметка служит и моментом
// блокировки состава, и началом недельного окна, за которое считаются очки.
export function nextSaturday9amUtc(from: Date): Date {
  const moscowNow = new Date(from.getTime() + MOSCOW_OFFSET_MS);
  const day = moscowNow.getUTCDay(); // 0=вс ... 6=сб (в московском "местном" времени)
  const hours = moscowNow.getUTCHours();

  let daysUntilSaturday = (6 - day + 7) % 7;
  if (daysUntilSaturday === 0 && hours >= 9) {
    daysUntilSaturday = 7;
  }

  const targetMoscowMidnight = Date.UTC(
    moscowNow.getUTCFullYear(),
    moscowNow.getUTCMonth(),
    moscowNow.getUTCDate() + daysUntilSaturday,
    9,
    0,
    0
  );

  return new Date(targetMoscowMidnight - MOSCOW_OFFSET_MS);
}

// Отдаёт (создавая при необходимости) fantasy_weeks-запись для ближайшей
// будущей субботы. unique(starts_at) + retry-по-конфликту защищают от
// дублей, если два пользователя попадут в эту функцию одновременно.
export async function getOrCreateCurrentFantasyWeek(): Promise<FantasyWeek> {
  const startsAt = nextSaturday9amUtc(new Date());
  const endsAt = new Date(startsAt.getTime() + WEEK_MS);
  const startsAtIso = startsAt.toISOString();

  const { data: existing, error: selectError } = await supabase
    .from("fantasy_weeks")
    .select("id, starts_at, ends_at")
    .eq("starts_at", startsAtIso)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Не удалось загрузить фэнтези-тур: ${selectError.message}`);
  }

  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from("fantasy_weeks")
    .insert({ starts_at: startsAtIso, ends_at: endsAt.toISOString() })
    .select("id, starts_at, ends_at")
    .single();

  if (insertError) {
    // Кто-то успел создать эту же неделю параллельно — просто перечитываем.
    const { data: afterConflict, error: refetchError } = await supabase
      .from("fantasy_weeks")
      .select("id, starts_at, ends_at")
      .eq("starts_at", startsAtIso)
      .maybeSingle();

    if (refetchError || !afterConflict) {
      throw new Error(`Не удалось создать фэнтези-тур: ${insertError.message}`);
    }

    return afterConflict;
  }

  return inserted;
}

// Человекочитаемое название тура по дате начала — "Тур — 9 августа".
export function formatFantasyWeekName(startsAt: string): string {
  const date = new Date(startsAt);
  return `Тур — ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`;
}
