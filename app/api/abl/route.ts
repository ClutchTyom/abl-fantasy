import { NextRequest, NextResponse } from "next/server";

const ABL_BASE_URL = "https://mtgame.ru/api/v1";

// mtgame.ru (бэкенд ABL) разрешает браузерные запросы (CORS) только со
// своих доменов и localhost — с боевого домена на Vercel запрос браузером
// напрямую падает ("Failed to fetch"). CORS — ограничение только для
// браузера, поэтому проксируем через собственный сервер: серверный fetch
// никаких CORS-ограничений не имеет, а браузер обращается уже к своему же
// домену.
//
// Прокси не должен быть открытым: пускаем только те пути, которые реально
// запрашивает lib/abl/sync.ts. Это же отсекает "../" и любые другие
// эндпоинты mtgame.ru.
const ALLOWED_PATHS = [
  /^\/league\/\d+\/tournaments\/[\w-]+\/$/,
  /^\/tournament\/\d+\/(teams|games)\/$/,
  /^\/tournament_team\/\d+\/users\/$/,
  /^\/tournament_game\/\d+\/users\/$/,
  /^\/tournament_basketball_game\/\d+\/user_statistic\/$/,
];

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path || !ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    return NextResponse.json(
      { error: "Query param 'path' is missing or not allowed" },
      { status: 400 }
    );
  }

  const res = await fetch(`${ABL_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
