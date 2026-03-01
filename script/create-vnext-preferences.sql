-- Creates vNext personalization tables.
-- Safe to run multiple times.

create table if not exists user_preferences (
  user_id text primary key,
  navigation jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
