-- Debug helper: confirms database/session and app table row counts.

select
  now() as checked_at,
  current_database() as database_name,
  current_user as database_user,
  inet_server_addr() as server_addr,
  inet_server_port() as server_port;

create temporary table if not exists _debug_table_counts (
  table_name text primary key,
  exists_in_public boolean not null,
  row_count bigint
) on commit drop;

truncate _debug_table_counts;

do $$
declare
  t text;
  rel regclass;
  c bigint;
begin
  foreach t in array array[
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
  ] loop
    rel := to_regclass(format('public.%I', t));
    if rel is null then
      insert into _debug_table_counts(table_name, exists_in_public, row_count)
      values (t, false, null);
    else
      execute format('select count(*)::bigint from public.%I', t) into c;
      insert into _debug_table_counts(table_name, exists_in_public, row_count)
      values (t, true, c);
    end if;
  end loop;
end $$;

select table_name, exists_in_public, row_count
from _debug_table_counts
order by table_name;
