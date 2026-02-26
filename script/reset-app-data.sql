-- Hard reset for app-owned data (keeps auth/users intact).
-- Use when old demo/testing data is mixed with real data.

begin;

do $$
declare
  truncate_targets text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
  into truncate_targets
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'budgets',
      'categories',
      'entries',
      'entry_history',
      'tags',
      'favorites',
      'savings_goals',
      'net_worth_accounts',
      'user_preferences',
      'dashboard_watchlists'
    );

  if truncate_targets is not null then
    execute format('truncate table %s restart identity cascade', truncate_targets);
  end if;
end $$;

commit;
