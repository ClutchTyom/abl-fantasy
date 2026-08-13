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

// Известные на данный момент дивизионы ABL. Список можно расширять по мере
// подключения новых дивизионов — раздел "Дивизионы" на ablforpeople.com.
export const ABL_DIVISIONS = [
  { alias: "restwblhigh", label: "WBL High (жен.)" },
  { alias: "restwbllove", label: "WBL Love (жен.)" },
  { alias: "resthigh26", label: "Rest High" },
  { alias: "restlove26", label: "Rest Love" },
  { alias: "resthard26", label: "Rest Hard" },
  { alias: "restbeef", label: "Rest Beef" },
  { alias: "restslam", label: "Rest Slam" },
  { alias: "resteasy26", label: "Rest Easy" },
  { alias: "restdrop26", label: "Rest Drop" },
  { alias: "restrofl26", label: "Rest Rofl" },
  { alias: "restflow", label: "Rest Flow" },
  { alias: "restsoft26", label: "Rest Soft" },
  { alias: "restlite26", label: "Rest Lite" },
] as const;
