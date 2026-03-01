-- Removes deprecated dashboard customization storage.
-- Safe to run multiple times.

begin;

drop table if exists dashboard_watchlists cascade;

alter table if exists user_preferences
  drop column if exists dashboard;

commit;
