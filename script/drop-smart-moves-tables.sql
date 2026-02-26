-- Run this against your app database after taking a DB backup/snapshot.
-- It permanently removes legacy Smart Moves, paycheck, and bill workflow tables.

begin;

drop table if exists bill_occurrences cascade;
drop table if exists bill_reminders cascade;
drop table if exists paycheck_allocations cascade;
drop table if exists paychecks cascade;
drop table if exists habit_checkins cascade;
drop table if exists habit_streaks cascade;
drop table if exists coach_tasks cascade;
drop table if exists coach_recommendations cascade;
drop table if exists roadmap_items cascade;
drop table if exists coach_settings cascade;

commit;
