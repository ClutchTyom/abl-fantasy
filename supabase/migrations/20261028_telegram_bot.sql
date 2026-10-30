create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  telegram_user_id bigint not null unique,
  username text,
  linked_at timestamptz not null default now()
);

create table if not exists public.telegram_link_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lock_reminder boolean not null default false,
  round_results boolean not null default false,
  match_schedule boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_notification_deliveries (
  event_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id bigint not null,
  sent_at timestamptz,
  primary key (event_key, user_id)
);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.telegram_notification_preferences enable row level security;
alter table public.telegram_notification_deliveries enable row level security;
