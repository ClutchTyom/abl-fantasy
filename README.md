# ABL Fantasy

Fantasy-лига по баскетболу [ABL](https://abl-fantasy.vercel.app/): соберите состав из 10 игроков (5 стартовых + 5 запасных), назначьте капитана и соревнуйтесь в рейтинге. Очки начисляются по реальной статистике матчей Amateur Basketball League.

## Стек

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Supabase (Postgres, Auth, RLS)
- Vercel (деплой и Cron: еженедельная синхронизация с ABL, Telegram-уведомления)
- Vitest — тесты очков, цен и фэнтези-недель

## Запуск

```bash
npm install
npm run dev
```

Нужен файл `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=https://abl-fantasy.vercel.app
```

Переменные Telegram-бота описаны в [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md).

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер |
| `npm run build` | production-сборка |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## База данных

Миграции лежат в `supabase/migrations/`, актуальный снимок схемы — `supabase/schema_snapshot.sql`.

## Лицензия

См. [LICENSE](LICENSE).
