const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;
const ABL_DIRECT_BASE_URL = "https://mtgame.ru/api/v1";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// В браузере запрос идёт не напрямую на mtgame.ru, а через наш серверный
// прокси (app/api/abl/route.ts) — mtgame.ru разрешает браузерные запросы
// (CORS) только со своих доменов и localhost, с боевого домена на Vercel
// прямой fetch из браузера падает с "Failed to fetch". На сервере (крон-
// синхронизация без браузера) прокси не нужен и не сработал бы как
// относительный URL — CORS вообще не применяется к серверным fetch, так
// что бьём в mtgame.ru напрямую.
//
// mtgame.ru время от времени отвечает 500 на отдельные запросы (похоже на
// перегрузку при массовом синке всех дивизионов подряд) — это не ошибка
// на нашей стороне и обычно проходит само, поэтому 5xx перезапрашиваем
// с задержкой перед тем как сдаться. 4xx (не наша вина чинить повтором) и
// сетевые/парсинг-ошибки — сразу наружу.
// Прокси доступен только вошедшим админам, поэтому в браузере к запросу
// добавляется токен текущей сессии Supabase. Клиент подгружается лениво,
// чтобы серверный код (крон) не тянул браузерный клиент.
async function proxyAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("@/lib/supabaseClient");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function ablGet<T>(path: string): Promise<T> {
  const isServer = typeof window === "undefined";
  const url = isServer
    ? `${ABL_DIRECT_BASE_URL}${path}`
    : `/api/abl?path=${encodeURIComponent(path)}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(isServer ? {} : await proxyAuthHeaders()),
      },
    });

    if (res.ok) {
      return res.json() as Promise<T>;
    }

    lastError = new Error(`ABL API ${path} -> HTTP ${res.status}`);

    if (res.status < 500 || attempt === RETRY_ATTEMPTS) {
      throw lastError;
    }

    await sleep(RETRY_BASE_DELAY_MS * attempt);
  }

  throw lastError!;
}

// Дивизионы сезона 2026/2027, сгруппированные по залам (поле location у
// турниров в API mtgame.ru). Квалификационные турниры (mos, profa,
// shelepiha27, perovo27, wblkval, purekval) закончились и сюда не входят.
// Зал нужен для рейтингов внутри зала и ограничения выбора игроков: slug
// должен совпадать с halls.slug (см. миграцию 20261029_halls.sql).
export const ABL_HALLS = [
  { slug: "moskvich", name: "Москвич" },
  { slug: "profa", name: "Профа" },
  { slug: "shelepiha", name: "Шелепиха" },
  { slug: "perovo", name: "Перово" },
  { slug: "pure", name: "PURE" },
  { slug: "wbl", name: "WBL" },
] as const;

export type AblHallSlug = (typeof ABL_HALLS)[number]["slug"];

// Список идёт от сильных дивизионов к слабым — порядок взят из поля sort
// турниров в API mtgame.ru (общий для всех залов), затем PURE и WBL. По
// нему сортируются выпадающие списки дивизионов (см. sortDivisionLabels).
export const ABL_DIVISIONS: readonly {
  alias: string;
  label: string;
  hall: AblHallSlug;
}[] = [
  { alias: "high26-27", label: "HIGH", hall: "shelepiha" },
  { alias: "love26-27", label: "LOVE", hall: "shelepiha" },
  { alias: "hard26-27", label: "HARD", hall: "shelepiha" },
  { alias: "beef26-27", label: "BEEF", hall: "shelepiha" },
  { alias: "slam26-27", label: "SLAM", hall: "perovo" },
  { alias: "easy26-27", label: "EASY", hall: "perovo" },
  { alias: "drop26-27", label: "DROP", hall: "perovo" },
  { alias: "rofl26-27", label: "ROFL", hall: "perovo" },
  { alias: "flow26-27", label: "FLOW", hall: "perovo" },
  { alias: "soft26-27", label: "SOFT", hall: "moskvich" },
  { alias: "lite26-27", label: "LITE", hall: "moskvich" },
  { alias: "base26-27", label: "BASE", hall: "moskvich" },
  { alias: "grow26-28", label: "GROW", hall: "moskvich" },
  { alias: "hope26-27", label: "HOPE", hall: "moskvich" },
  { alias: "pale26-27", label: "PALE", hall: "profa" },
  { alias: "slow26-27", label: "SLOW", hall: "profa" },
  { alias: "rook26-27", label: "ROOK", hall: "profa" },
  { alias: "last26-27", label: "LAST", hall: "profa" },
  { alias: "purehigh26-27", label: "PURE HIGH", hall: "pure" },
  { alias: "purelove26-27", label: "PURE LOVE", hall: "pure" },
  { alias: "wblhigh26-27", label: "WBL HIGH", hall: "wbl" },
  { alias: "wbllove26-27", label: "WBL LOVE", hall: "wbl" },
  { alias: "wbleasy26-27", label: "WBL EASY", hall: "wbl" },
  { alias: "wblrofl26-27", label: "WBL ROFL", hall: "wbl" },
];

// Сортирует названия дивизионов от сильных к слабым. Названия, которых нет
// в ABL_DIVISIONS (например, дивизионы прошлых сезонов), идут в конце по
// алфавиту.
export function sortDivisionLabels(labels: Iterable<string>): string[] {
  const rank = new Map<string, number>(
    ABL_DIVISIONS.map((division, index) => [division.label, index])
  );
  return Array.from(new Set(labels)).sort((a, b) => {
    const rankA = rank.get(a);
    const rankB = rank.get(b);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return a.localeCompare(b, "ru");
  });
}
