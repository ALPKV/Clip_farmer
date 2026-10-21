/** Idempotent schema, applied on the first query after each server start. */
export const SCHEMA_SQL = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'all-rounder',
  weight_kg real,
  season_start date,
  season_end date,
  created_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_user on auth_sessions(user_id);

create table if not exists login_attempts (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  category text not null,
  title text not null default '',
  status text not null default 'planned',
  planned_minutes integer,
  duration_min integer,
  rpe integer,
  intent text not null default '',
  reflection text not null default '',
  details jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  logged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists practice_user_date on practice_sessions(user_id, date);

create table if not exists match_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  opponent text not null default '',
  format text not null default 'T20',
  batted boolean not null default true,
  runs integer not null default 0,
  balls_faced integer not null default 0,
  not_out boolean not null default false,
  dismissal text not null default '',
  dismissal_error text not null default '',
  balls_bowled integer not null default 0,
  runs_conceded integer not null default 0,
  wickets integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists match_user_date on match_logs(user_id, date);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  pillar text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  metric text not null,
  unit text not null default '',
  target real not null,
  baseline real not null default 0,
  manual_current real,
  season_start date not null,
  season_end date not null,
  created_at timestamptz not null default now()
);

create table if not exists carb_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  meal text not null,
  carbs_g real not null,
  timing text not null default 'meal',
  created_at timestamptz not null default now()
);
create index if not exists carb_user_date on carb_logs(user_id, date);

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  speed_kmh real,
  length_m real,
  line_cm real,
  video_name text not null default '',
  clip_time real,
  method text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists deliveries_user_date on deliveries(user_id, date);
`;
