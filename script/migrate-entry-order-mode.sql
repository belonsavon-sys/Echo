-- Adds budget entry ordering mode (auto date vs manual).
-- Safe to run multiple times.

begin;

alter table if exists public.budgets
  add column if not exists entry_order_mode text not null default 'auto_date';

update public.budgets
set entry_order_mode = 'auto_date'
where entry_order_mode is null
   or entry_order_mode not in ('auto_date', 'manual');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'budgets_entry_order_mode_check'
  ) then
    alter table public.budgets
      add constraint budgets_entry_order_mode_check
      check (entry_order_mode in ('auto_date', 'manual'));
  end if;
end $$;

commit;
