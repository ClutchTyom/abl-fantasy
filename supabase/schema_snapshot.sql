-- СПРАВОЧНЫЙ снимок схемы public живой базы Supabase (на 2026-10-29, после
-- миграции 20261101_close_squad_and_week_holes). Это НЕ миграция — не
-- применять, он нужен, чтобы видеть реальную схему целиком.
--
-- Почему он нужен: миграции до 20261029 применялись вручную через SQL
-- Editor и частично устарели относительно базы (например, блокировка
-- составов в 20260803_squad_lock_by_time.sql написана по rounds.lock_at,
-- а в базе — по fantasy_weeks.starts_at). Новые изменения оформляем
-- миграциями и после применения обновляем этот файл.
--
-- Что выглядит устаревшим, но живо в базе:
--   * rounds / matches.round_id — календарь матчей ABL (туры ABL);
--   * fantasy_weeks / fantasy_squads.round_id — недели игры (на самом деле
--     fantasy_squads.round_id ссылается на fantasy_weeks, не на rounds);
--   * user_teams, user_team_roster — старая модель состава, в коде не
--     используется (в user_team_roster player_id integer не совпадает с
--     players.id uuid). Кандидаты на удаление.

set search_path = public;

-- ==================== Таблицы ====================

create table halls (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  sort integer not null default 0
);

create table teams (
  id uuid not null default gen_random_uuid(),
  name text not null,
  short_name text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  abl_id text,
  division text,
  hall_id uuid,
  archived_at timestamptz,
  synced_at timestamptz
);

create table players (
  id uuid not null default gen_random_uuid(),
  team_id uuid not null,
  full_name text not null,
  position text not null,
  price numeric(4,1) not null,
  photo_url text,
  is_active boolean not null default true, -- не используется кодом, см. archived_at
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  abl_id text,
  archived_at timestamptz,
  synced_at timestamptz
);

create table profiles (
  id uuid not null,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  is_admin boolean not null default false,
  privacy_consent_at timestamptz,
  hall_id uuid
);

create table rounds (
  id uuid not null default gen_random_uuid(),
  name text not null,
  status text not null default 'upcoming',
  lock_at timestamptz not null,
  created_at timestamptz not null default now(),
  start_time timestamptz,
  end_time timestamptz,
  is_active boolean default false,
  abl_id text
);

create table matches (
  id uuid not null default gen_random_uuid(),
  round_id uuid not null,
  home_team_id uuid not null,
  away_team_id uuid not null,
  starts_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  abl_id text
);

create table player_match_stats (
  id uuid not null default gen_random_uuid(),
  match_id uuid not null,
  player_id uuid not null,
  two_pt_made integer not null default 0,
  two_pt_miss integer not null default 0,
  three_pt_made integer not null default 0,
  three_pt_miss integer not null default 0,
  ft_made integer not null default 0,
  ft_miss integer not null default 0,
  rebounds integer not null default 0,
  assists integer not null default 0,
  steals integer not null default 0,
  blocks integer not null default 0,
  turnovers integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fantasy_weeks (
  id uuid not null default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table fantasy_squads (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  round_id uuid not null, -- ссылается на fantasy_weeks.id
  captain_player_id uuid,
  budget_spent numeric(5,1) not null default 0,
  total_points numeric(7,2),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fantasy_squad_players (
  id uuid not null default gen_random_uuid(),
  squad_id uuid not null,
  player_id uuid not null,
  slot text not null,
  is_captain boolean not null default false,
  substituted_by_id uuid,
  points_earned numeric(6,2) not null default 0
);

create table sync_runs (
  id uuid not null default gen_random_uuid(),
  division_alias text not null,
  division_label text not null,
  finished_at timestamptz not null default now(),
  teams integer not null,
  players integer not null,
  rounds integer not null,
  matches integer not null,
  stats integer not null,
  warnings integer not null
);

-- Устаревшая модель состава (не используется приложением).
create table user_teams (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  round_id uuid not null,
  budget integer not null default 100,
  spent integer not null default 0,
  is_locked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table user_team_roster (
  id uuid not null default gen_random_uuid(),
  user_team_id uuid not null,
  player_id integer not null,
  slot_type text not null,
  is_captain boolean default false
);

-- ==================== Ограничения ====================

alter table halls add constraint halls_pkey primary key (id);
alter table halls add constraint halls_slug_key unique (slug);

alter table teams add constraint teams_pkey primary key (id);
alter table teams add constraint teams_abl_id_key unique (abl_id);
alter table teams add constraint teams_short_name_key unique (short_name);
alter table teams add constraint teams_hall_id_fkey foreign key (hall_id) references halls(id);

alter table players add constraint players_pkey primary key (id);
alter table players add constraint players_abl_id_key unique (abl_id);
alter table players add constraint players_position_check check (position = any (array['PG','SG','SF','PF','C']));
alter table players add constraint players_price_check check (price >= 6 and price <= 17);
alter table players add constraint players_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;

alter table profiles add constraint profiles_pkey primary key (id);
alter table profiles add constraint profiles_username_key unique (username);
alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table profiles add constraint profiles_hall_id_fkey foreign key (hall_id) references halls(id);

alter table rounds add constraint rounds_pkey primary key (id);
alter table rounds add constraint rounds_abl_id_key unique (abl_id);
alter table rounds add constraint rounds_status_check check (status = any (array['upcoming','live','completed']));

alter table matches add constraint matches_pkey primary key (id);
alter table matches add constraint matches_abl_id_key unique (abl_id);
alter table matches add constraint matches_check check (home_team_id <> away_team_id);
alter table matches add constraint matches_status_check check (status = any (array['scheduled','live','finished']));
alter table matches add constraint matches_round_id_fkey foreign key (round_id) references rounds(id) on delete cascade;
alter table matches add constraint matches_home_team_id_fkey foreign key (home_team_id) references teams(id);
alter table matches add constraint matches_away_team_id_fkey foreign key (away_team_id) references teams(id);

alter table player_match_stats add constraint player_match_stats_pkey primary key (id);
alter table player_match_stats add constraint player_match_stats_match_id_player_id_key unique (match_id, player_id);
alter table player_match_stats add constraint player_match_stats_match_id_fkey foreign key (match_id) references matches(id) on delete cascade;
alter table player_match_stats add constraint player_match_stats_player_id_fkey foreign key (player_id) references players(id) on delete cascade;

alter table fantasy_weeks add constraint fantasy_weeks_pkey primary key (id);
alter table fantasy_weeks add constraint fantasy_weeks_starts_at_key unique (starts_at);

alter table fantasy_squads add constraint fantasy_squads_pkey primary key (id);
alter table fantasy_squads add constraint fantasy_squads_user_id_round_id_key unique (user_id, round_id);
alter table fantasy_squads add constraint fantasy_squads_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
alter table fantasy_squads add constraint fantasy_squads_round_id_fkey foreign key (round_id) references fantasy_weeks(id) on delete cascade;
alter table fantasy_squads add constraint fantasy_squads_captain_player_id_fkey foreign key (captain_player_id) references players(id);

alter table fantasy_squad_players add constraint fantasy_squad_players_pkey primary key (id);
alter table fantasy_squad_players add constraint fantasy_squad_players_squad_id_player_id_key unique (squad_id, player_id);
alter table fantasy_squad_players add constraint fantasy_squad_players_squad_id_slot_key unique (squad_id, slot);
alter table fantasy_squad_players add constraint fantasy_squad_players_slot_check
  check (slot = any (array['PG','SG','SF','PF','C','BENCH1','BENCH2','BENCH3','BENCH4','BENCH5']));
alter table fantasy_squad_players add constraint fantasy_squad_players_squad_id_fkey foreign key (squad_id) references fantasy_squads(id) on delete cascade;
alter table fantasy_squad_players add constraint fantasy_squad_players_player_id_fkey foreign key (player_id) references players(id);
alter table fantasy_squad_players add constraint fantasy_squad_players_substituted_by_id_fkey foreign key (substituted_by_id) references players(id);

alter table sync_runs add constraint sync_runs_pkey primary key (id);

alter table user_teams add constraint user_teams_pkey primary key (id);
alter table user_teams add constraint user_teams_user_id_round_id_key unique (user_id, round_id);
alter table user_teams add constraint user_teams_budget_check check (budget = 100);
alter table user_teams add constraint user_teams_spent_check check (spent >= 0 and spent <= 100);
alter table user_teams add constraint user_teams_round_id_fkey foreign key (round_id) references rounds(id) on delete cascade;
alter table user_teams add constraint user_teams_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table user_team_roster add constraint user_team_roster_pkey primary key (id);
alter table user_team_roster add constraint user_team_roster_user_team_id_player_id_key unique (user_team_id, player_id);
alter table user_team_roster add constraint user_team_roster_user_team_id_slot_type_key unique (user_team_id, slot_type);
alter table user_team_roster add constraint user_team_roster_slot_type_check
  check (slot_type = any (array['STARTER_PG','STARTER_SG','STARTER_SF','STARTER_PF','STARTER_C','BENCH_1','BENCH_2']));
alter table user_team_roster add constraint user_team_roster_user_team_id_fkey foreign key (user_team_id) references user_teams(id) on delete cascade;

-- ==================== Индексы ====================

create index idx_matches_round on matches using btree (round_id);
create index idx_players_position on players using btree (position);
create index idx_players_team on players using btree (team_id);
create index idx_roster_player on user_team_roster using btree (player_id);
create index idx_roster_user_team on user_team_roster using btree (user_team_id);
create index idx_squad_players_player on fantasy_squad_players using btree (player_id);
create index idx_squad_players_squad on fantasy_squad_players using btree (squad_id);
create index idx_squads_round on fantasy_squads using btree (round_id);
create index idx_user_teams_user_round on user_teams using btree (user_id, round_id);
create index player_match_stats_match_id_idx on player_match_stats using btree (match_id);
create index player_match_stats_player_id_idx on player_match_stats using btree (player_id);
create index profiles_hall_id_idx on profiles using btree (hall_id);
create index teams_hall_id_idx on teams using btree (hall_id);

-- ==================== Row Level Security ====================
-- Включён на всех таблицах. Права на колонки profiles: клиентам (anon,
-- authenticated) разрешено UPDATE только username, avatar_url,
-- privacy_consent_at (см. 20261029_lock_down_profiles_and_functions.sql);
-- is_admin и hall_id меняются только через security definer RPC.

alter table fantasy_squad_players enable row level security;
alter table fantasy_squads enable row level security;
alter table fantasy_weeks enable row level security;
alter table halls enable row level security;
alter table matches enable row level security;
alter table player_match_stats enable row level security;
alter table players enable row level security;
alter table profiles enable row level security;
alter table rounds enable row level security;
alter table sync_runs enable row level security;
alter table teams enable row level security;
alter table user_team_roster enable row level security;
alter table user_teams enable row level security;

-- Общий предикат "текущий пользователь — админ":
--   exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin)

-- --- fantasy_squads: свои составы пишет владелец, читают все (рейтинг);
--     restrictive-политики режут запись после начала недели.
create policy "read own squads" on fantasy_squads as permissive for select to public using (auth.uid() = user_id);
create policy "fantasy_squads_select_all" on fantasy_squads as permissive for select to public using (true);
create policy "insert own squad" on fantasy_squads as permissive for insert to public with check (auth.uid() = user_id);
create policy "update own squad" on fantasy_squads as permissive for update to public using (auth.uid() = user_id);
create policy "delete own squad" on fantasy_squads as permissive for delete to public using (auth.uid() = user_id);
create policy "fantasy_squads_lock_insert" on fantasy_squads as restrictive for insert to public
  with check (exists (select 1 from fantasy_weeks where fantasy_weeks.id = fantasy_squads.round_id and fantasy_weeks.starts_at > now()));
create policy "fantasy_squads_lock_update" on fantasy_squads as restrictive for update to public
  with check (exists (select 1 from fantasy_weeks where fantasy_weeks.id = fantasy_squads.round_id and fantasy_weeks.starts_at > now()));
create policy "fantasy_squads_lock_delete" on fantasy_squads as restrictive for delete to public
  using (exists (select 1 from fantasy_weeks where fantasy_weeks.id = fantasy_squads.round_id and fantasy_weeks.starts_at > now()));

-- --- fantasy_squad_players
create policy "read own squad players" on fantasy_squad_players as permissive for select to public
  using (exists (select 1 from fantasy_squads s where s.id = fantasy_squad_players.squad_id and s.user_id = auth.uid()));
create policy "fantasy_squad_players_select_all" on fantasy_squad_players as permissive for select to public using (true);
create policy "insert own squad players" on fantasy_squad_players as permissive for insert to public
  with check (exists (select 1 from fantasy_squads s where s.id = fantasy_squad_players.squad_id and s.user_id = auth.uid()));
create policy "update own squad players" on fantasy_squad_players as permissive for update to public
  using (exists (select 1 from fantasy_squads s where s.id = fantasy_squad_players.squad_id and s.user_id = auth.uid()));
create policy "delete own squad players" on fantasy_squad_players as permissive for delete to public
  using (exists (select 1 from fantasy_squads s where s.id = fantasy_squad_players.squad_id and s.user_id = auth.uid()));
create policy "fantasy_squad_players_lock_insert" on fantasy_squad_players as restrictive for insert to public
  with check (exists (select 1 from fantasy_squads join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
    where fantasy_squads.id = fantasy_squad_players.squad_id and fantasy_weeks.starts_at > now()));
create policy "fantasy_squad_players_lock_update" on fantasy_squad_players as restrictive for update to public
  with check (exists (select 1 from fantasy_squads join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
    where fantasy_squads.id = fantasy_squad_players.squad_id and fantasy_weeks.starts_at > now()));
create policy "fantasy_squad_players_lock_delete" on fantasy_squad_players as restrictive for delete to public
  using (exists (select 1 from fantasy_squads join fantasy_weeks on fantasy_weeks.id = fantasy_squads.round_id
    where fantasy_squads.id = fantasy_squad_players.squad_id and fantasy_weeks.starts_at > now()));

-- --- fantasy_weeks: читают все; создать можно только ближайшую будущую
--     субботу 09:00 МСК длиной 7 дней (так её создаёт lib/fantasyWeeks.ts).
create policy "fantasy_weeks_select_all" on fantasy_weeks as permissive for select to public using (true);
create policy "fantasy_weeks_insert_authenticated" on fantasy_weeks as permissive for insert to authenticated
  with check (
    ends_at = starts_at + interval '7 days'
    and starts_at > now()
    and starts_at <= now() + interval '7 days'
    and extract(isodow from starts_at at time zone 'Europe/Moscow') = 6
    and (starts_at at time zone 'Europe/Moscow')
        = date_trunc('day', starts_at at time zone 'Europe/Moscow') + interval '9 hours'
  );

-- --- halls
create policy "halls_select_all" on halls as permissive for select to public using (true);

-- --- teams / players / matches / rounds: читают все, пишут админы
create policy "public read teams" on teams as permissive for select to public using (true);
create policy "teams_select_all" on teams as permissive for select to public using (true);
create policy "admins manage teams" on teams as permissive for all to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create policy "public read players" on players as permissive for select to public using (true);
create policy "admins manage players" on players as permissive for all to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create policy "public read matches" on matches as permissive for select to public using (true);
create policy "matches_select_all" on matches as permissive for select to public using (true);
create policy "admins manage matches" on matches as permissive for all to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

create policy "public read rounds" on rounds as permissive for select to public using (true);
create policy "rounds_select_all" on rounds as permissive for select to public using (true);
create policy "Anyone can view rounds" on rounds as permissive for select to authenticated using (true);
create policy "admins manage rounds" on rounds as permissive for all to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- --- player_match_stats: читают все, пишут админы
create policy "player_match_stats_select_all" on player_match_stats as permissive for select to public using (true);
create policy "player_match_stats_insert_admin" on player_match_stats as permissive for insert to public
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));
create policy "player_match_stats_update_admin" on player_match_stats as permissive for update to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));
create policy "player_match_stats_delete_admin" on player_match_stats as permissive for delete to public
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- --- profiles: читают все (рейтинг), свой профиль создаёт/меняет владелец
--     (меняет только разрешённые колонки, см. выше)
create policy "profiles_select_all" on profiles as permissive for select to public using (true);
create policy "read own profile" on profiles as permissive for select to public using (true);
create policy "insert own profile" on profiles as permissive for insert to public with check (auth.uid() = id);
create policy "update own profile" on profiles as permissive for update to public using (auth.uid() = id);

-- --- sync_runs: только админы
create policy "sync_runs_select_admin" on sync_runs as permissive for select to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));
create policy "sync_runs_insert_admin" on sync_runs as permissive for insert to authenticated
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- --- устаревшие user_teams / user_team_roster
create policy "Users can view own teams" on user_teams as permissive for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own teams" on user_teams as permissive for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own teams" on user_teams as permissive for update to authenticated using (auth.uid() = user_id);
create policy "Users can view own roster" on user_team_roster as permissive for select to authenticated
  using (exists (select 1 from user_teams where user_teams.id = user_team_roster.user_team_id and user_teams.user_id = auth.uid()));
create policy "Users can modify own roster" on user_team_roster as permissive for all to authenticated
  using (exists (select 1 from user_teams where user_teams.id = user_team_roster.user_team_id and user_teams.user_id = auth.uid()));

-- ==================== Функции ====================
-- Тела функций хранятся в миграциях, где они были созданы в последний раз:
--   handle_new_user            20260804_profile_auto_create_and_consent.sql (триггер на auth.users)
--   admin_set_is_admin         20260804_admin_user_management.sql
--   admin_list_users           20261031_fix_admin_list_users_email_type.sql
--   join_hall,
--   admin_set_user_hall,
--   check_player_in_hall       20261029_halls.sql (check_player_in_hall — переопределена в 20261030_archive.sql)
--   bulk_upsert_teams,
--   bulk_upsert_players        20261030_archive.sql
--   admin_restore_archive      20261030_archive.sql
--   archive_stale (только service_role, для крона),
--   admin_archive_stale (обёртка с проверкой админа)  20261102_archive_stale_for_cron.sql
--   set_updated_at, check_single_captain, check_round_not_locked,
--   check_squad_constraints    не заведены миграциями (созданы вручную); тела ниже.
-- У всех функций search_path = public. EXECUTE у admin_*/join_hall закрыт
-- для anon, открыт для authenticated (внутри проверка is_admin / auth.uid()).

create function set_updated_at() returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function check_single_captain() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.is_captain then
    if exists (
      select 1 from fantasy_squad_players
      where squad_id = new.squad_id
        and is_captain = true
        and id <> coalesce(new.id, gen_random_uuid())
    ) then
      raise exception 'В составе уже есть капитан';
    end if;
  end if;
  return new;
end;
$$;

-- Админский флаг fantasy_squads.is_locked; блокировка по времени — в RLS выше.
create function check_round_not_locked() returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_locked boolean;
begin
  select is_locked into v_locked
  from fantasy_squads where id = coalesce(new.squad_id, old.squad_id);

  if v_locked then
    raise exception 'Состав заблокирован — тур уже начался';
  end if;
  return coalesce(new, old);
end;
$$;

-- Не более 10 игроков, бюджет не больше 100, не более 2 игроков из одной команды.
create function check_squad_constraints() returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_squad_id uuid;
  v_total_price numeric;
  v_player_count int;
  v_max_per_team int;
begin
  v_squad_id := coalesce(new.squad_id, old.squad_id);

  select count(*) into v_player_count
  from fantasy_squad_players where squad_id = v_squad_id;

  if v_player_count > 10 then
    raise exception 'В составе не может быть больше 10 игроков';
  end if;

  select coalesce(sum(p.price), 0) into v_total_price
  from fantasy_squad_players fsp
  join players p on p.id = fsp.player_id
  where fsp.squad_id = v_squad_id;

  if v_total_price > 100 then
    raise exception 'Превышен бюджет 100 монет (сейчас %)', v_total_price;
  end if;

  select max(cnt) into v_max_per_team
  from (
    select count(*) cnt
    from fantasy_squad_players fsp
    join players p on p.id = fsp.player_id
    where fsp.squad_id = v_squad_id
    group by p.team_id
  ) t;

  if v_max_per_team > 2 then
    raise exception 'Не более 2 игроков из одной команды';
  end if;

  return null;
end;
$$;

-- ==================== Триггеры ====================

create trigger trg_player_in_hall before insert or update of player_id on fantasy_squad_players
  for each row execute function check_player_in_hall();
create trigger trg_round_not_locked before insert or delete or update on fantasy_squad_players
  for each row execute function check_round_not_locked();
create trigger trg_single_captain before insert or update on fantasy_squad_players
  for each row execute function check_single_captain();
create trigger trg_squad_constraints after insert or delete or update on fantasy_squad_players
  for each row execute function check_squad_constraints();
create trigger player_match_stats_set_updated_at before update on player_match_stats
  for each row execute function set_updated_at();
-- auth.users: on_auth_user_created after insert -> handle_new_user()
