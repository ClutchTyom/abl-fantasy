// Пути API mtgame.ru, которые разрешено проксировать через /api/abl: ровно
// те, что запрашивает lib/abl/sync.ts. Строгие шаблоны заодно отсекают "../"
// и любые другие эндпоинты mtgame.ru.
const ALLOWED_PATHS = [
  /^\/league\/\d+\/tournaments\/[\w-]+\/$/,
  /^\/tournament\/\d+\/(teams|games)\/$/,
  /^\/tournament_team\/\d+\/users\/$/,
  /^\/tournament_game\/\d+\/users\/$/,
  /^\/tournament_basketball_game\/\d+\/user_statistic\/$/,
];

export function isAllowedAblPath(path: string | null): path is string {
  return path !== null && ALLOWED_PATHS.some((pattern) => pattern.test(path));
}
