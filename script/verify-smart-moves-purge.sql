-- Should return zero rows after purge.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'coach_settings',
    'roadmap_items',
    'coach_recommendations',
    'coach_tasks',
    'habit_streaks',
    'habit_checkins',
    'paychecks',
    'paycheck_allocations',
    'bill_reminders',
    'bill_occurrences'
  );
