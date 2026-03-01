-- Adds opening balance carryover fields and recurring amount cap support.
-- Safe to run multiple times.

begin;

alter table if exists public.budgets
  add column if not exists opening_balance numeric(14, 2) not null default 0,
  add column if not exists opening_balance_mode text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'budgets_opening_balance_mode_check'
  ) then
    alter table public.budgets
      add constraint budgets_opening_balance_mode_check
      check (opening_balance_mode in ('manual', 'carryover'));
  end if;
end $$;

alter table if exists public.entries
  add column if not exists recurring_end_amount numeric(14, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'entries_recurring_end_amount_positive_check'
  ) then
    alter table public.entries
      add constraint entries_recurring_end_amount_positive_check
      check (recurring_end_amount is null or recurring_end_amount > 0);
  end if;
end $$;

commit;
