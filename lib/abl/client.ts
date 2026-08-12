// Запрос идёт не напрямую на mtgame.ru, а через наш серверный прокси
// (app/api/abl/route.ts) — mtgame.ru разрешает браузерные запросы (CORS)
// только со своих доменов и localhost, с боевого домена на Vercel прямой
// fetch из браузера падает с "Failed to fetch". Серверный fetch CORS не
// подчиняется, поэтому браузер обращается к своему же домену, а он уже
// проксирует запрос дальше.
export async function ablGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/abl?path=${encodeURIComponent(path)}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`ABL API ${path} -> HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
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
