-- Creates vNext personalization tables.
-- Safe to run multiple times.

create table if not exists user_preferences (
  user_id text primary key,
  navigation jsonb not null default '{}'::jsonb,
  dashboard jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists dashboard_watchlists (
  id integer generated always as identity primary key,
  user_id text not null,
  name text not null,
  budget_id integer,
  category_id integer,
  target_amount real not null default 0,
  month_key_scope text not null default 'current',
  fixed_month_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists dashboard_watchlists_user_idx
  on dashboard_watchlists (user_id, sort_order, id);
