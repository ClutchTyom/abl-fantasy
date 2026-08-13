const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Запрос идёт не напрямую на mtgame.ru, а через наш серверный прокси
// (app/api/abl/route.ts) — mtgame.ru разрешает браузерные запросы (CORS)
// только со своих доменов и localhost, с боевого домена на Vercel прямой
// fetch из браузера падает с "Failed to fetch". Серверный fetch CORS не
// подчиняется, поэтому браузер обращается к своему же домену, а он уже
// проксирует запрос дальше.
//
// mtgame.ru время от времени отвечает 500 на отдельные запросы (похоже на
// перегрузку при массовом синке всех дивизионов подряд) — это не ошибка
// на нашей стороне и обычно проходит само, поэтому 5xx перезапрашиваем
// с задержкой перед тем как сдаться. 4xx (не наша вина чинить повтором) и
// сетевые/парсинг-ошибки — сразу наружу.
export async function ablGet<T>(path: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const res = await fetch(`/api/abl?path=${encodeURIComponent(path)}`, {
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
