# Telegram bot setup

## 1. Configure Supabase

Apply `supabase/migrations/20261028_telegram_bot.sql` to the project's Supabase
database, either through the Supabase SQL Editor or the Supabase CLI.

The bot uses the existing `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables.
The service-role key is only used by server-side route handlers; never expose it
to the browser.

## 2. Create and configure the bot

1. Create a bot with [@BotFather](https://t.me/BotFather) and save its token as
   `TELEGRAM_BOT_TOKEN`.
2. Set `TELEGRAM_BOT_USERNAME` to the bot username without the `@`.
3. Generate a random secret containing only letters, numbers, `_` or `-`, and
   set it as `TELEGRAM_WEBHOOK_SECRET`.
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin of the site.
5. Add those variables to the hosting provider, along with the existing
   Supabase variables and `CRON_SECRET`.
6. Deploy the site, then configure the Mini App domain with BotFather so
   Telegram allows the `/team` web app button.

Do not commit bot or Supabase secrets to the repository.

## 3. Register the webhook

After deployment, call Telegram's `setWebhook` method. Keep the bot token and
webhook secret in your local shell/environment rather than committing them:

```powershell
$body = @{
  url = "https://YOUR_SITE_DOMAIN/api/telegram/webhook"
  secret_token = $env:TELEGRAM_WEBHOOK_SECRET
}
Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/setWebhook" `
  -ContentType "application/json" `
  -Body ($body | ConvertTo-Json)
```

In the hosting environment, make sure `CRON_SECRET` is set. Vercel will use it
to authorize the daily `/api/cron/telegram-notifications` job.

## 4. Use the bot

Open `/telegram` on the website while signed in and choose **Привязать
Telegram**. The generated one-time link expires after 10 minutes. In Telegram:

- `/schedule`, `/teams`, `/players`, `/rules`, and `/rating` provide public
  information.
- `/me` shows the linked account's latest completed fantasy result.
- `/app` opens the team page inside Telegram.
- `/notify` opts in to lock reminders, matches in the next 48 hours, and round
  results. `/stop` disables them; `/unlink` removes the account link and
  disables notifications.

Notifications are opt-in. The bot only handles private chats.
