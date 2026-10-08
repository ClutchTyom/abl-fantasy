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
export async function ablGet<T>(path: string): Promise<T> {
  const isServer = typeof window === "undefined";
  const url = isServer
    ? `${ABL_DIRECT_BASE_URL}${path}`
    : `/api/abl?path=${encodeURIComponent(path)}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
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

// Дивизионы на текущий сезон ABL (2026/2027 — проверено на ablforpeople.com
// и напрямую через /league/2/tournaments/ в октябре 2026). Прошлый список
// (restwblhigh, restwbllove, resthigh26, restlove26, resthard26, restbeef,
// restslam, resteasy26, restdrop26, restflow) был под старый сезон — эти
// турниры закончились и больше не возвращаются API, из старых "Rest*"
// выжили только restrofl26/restlite26/restsoft26. По просьбе — взрослые
// дивизионы, кроме Астаны и PLUS, плюс все возраста PYC (без PPC).
export const ABL_DIVISIONS = [
  { alias: "shelepiha27", label: "Шелепиха" },
  { alias: "perovo27", label: "Перово" },
  { alias: "mos", label: "Москвич" },
  { alias: "profa", label: "Профа" },
  { alias: "wblkval", label: "WBL (жен.)" },
  { alias: "purekval", label: "PURE" },
  { alias: "restrofl26", label: "Rest Rofl" },
  { alias: "restlite26", label: "Rest Lite" },
  { alias: "restsoft26", label: "Rest Soft" },
  { alias: "kids10-11", label: "PYC U16" },
  { alias: "kids12-13", label: "PYC U14" },
  { alias: "kids14-15", label: "PYC U12" },
  { alias: "kids16-17", label: "PYC U10" },
] as const;
