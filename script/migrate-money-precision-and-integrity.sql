-- Hardens financial precision and relational integrity.
-- Safe to run multiple times.

begin;

-- Normalize blank user IDs from legacy/testing states.
update public.budgets set user_id = 'local-dev-user' where coalesce(trim(user_id), '') = '';
update public.tags set user_id = 'local-dev-user' where coalesce(trim(user_id), '') = '';
update public.savings_goals set user_id = 'local-dev-user' where coalesce(trim(user_id), '') = '';
update public.favorites set user_id = 'local-dev-user' where coalesce(trim(user_id), '') = '';
update public.net_worth_accounts set user_id = 'local-dev-user' where coalesce(trim(user_id), '') = '';
delete from public.user_preferences where coalesce(trim(user_id), '') = '';

-- Ensure every referenced user_id exists in public.users.
insert into public.users (id)
select distinct uid
from (
  select user_id as uid from public.budgets
  union
  select user_id as uid from public.tags
  union
  select user_id as uid from public.savings_goals
  union
  select user_id as uid from public.favorites
  union
  select user_id as uid from public.net_worth_accounts
  union
  select user_id as uid from public.user_preferences
) all_users
where uid is not null and trim(uid) <> ''
on conflict (id) do nothing;

-- Clean orphan references before adding foreign keys.
update public.budgets b
set parent_id = null
where parent_id is not null
  and not exists (
    select 1
    from public.budgets parent
    where parent.id = b.parent_id
  );

delete from public.categories c
where not exists (
  select 1
  from public.budgets b
  where b.id = c.budget_id
);

update public.entries e
set category_id = null
where category_id is not null
  and not exists (
    select 1
    from public.categories c
    where c.id = e.category_id
  );

update public.entries e
set recurring_parent_id = null
where recurring_parent_id is not null
  and not exists (
    select 1
    from public.entries parent
    where parent.id = e.recurring_parent_id
  );

delete from public.entries e
where not exists (
  select 1
  from public.budgets b
  where b.id = e.budget_id
);

delete from public.entry_history h
where not exists (
    select 1
    from public.budgets b
    where b.id = h.budget_id
  )
  or not exists (
    select 1
    from public.entries e
    where e.id = h.entry_id
  );

update public.savings_goals g
set budget_id = null
where budget_id is not null
  and not exists (
    select 1
    from public.budgets b
    where b.id = g.budget_id
  );

update public.favorites f
set category_id = null
where category_id is not null
  and not exists (
    select 1
    from public.categories c
    where c.id = f.category_id
  );

-- Money columns: move from floating-point to exact numeric.
alter table if exists public.budgets
  alter column rollover_amount type numeric(14, 2)
  using round(coalesce(rollover_amount, 0)::numeric, 2),
  alter column rollover_amount set default 0;

alter table if exists public.categories
  alter column budget_limit type numeric(14, 2)
  using case
    when budget_limit is null then null
    else round(budget_limit::numeric, 2)
  end;

alter table if exists public.entries
  alter column amount type numeric(14, 2)
  using round(amount::numeric, 2);

alter table if exists public.savings_goals
  alter column target_amount type numeric(14, 2)
  using round(target_amount::numeric, 2),
  alter column current_amount type numeric(14, 2)
  using round(coalesce(current_amount, 0)::numeric, 2),
  alter column current_amount set default 0;

alter table if exists public.favorites
  alter column amount type numeric(14, 2)
  using round(amount::numeric, 2);

alter table if exists public.net_worth_accounts
  alter column balance type numeric(14, 2)
  using round(balance::numeric, 2);

-- Foreign keys.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_parent_id_fkey') then
    alter table public.budgets
      add constraint budgets_parent_id_fkey
      foreign key (parent_id) references public.budgets(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_user_id_fkey') then
    alter table public.budgets
      add constraint budgets_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_budget_id_fkey') then
    alter table public.categories
      add constraint categories_budget_id_fkey
      foreign key (budget_id) references public.budgets(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entries_budget_id_fkey') then
    alter table public.entries
      add constraint entries_budget_id_fkey
      foreign key (budget_id) references public.budgets(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entries_category_id_fkey') then
    alter table public.entries
      add constraint entries_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entries_recurring_parent_id_fkey') then
    alter table public.entries
      add constraint entries_recurring_parent_id_fkey
      foreign key (recurring_parent_id) references public.entries(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entry_history_budget_id_fkey') then
    alter table public.entry_history
      add constraint entry_history_budget_id_fkey
      foreign key (budget_id) references public.budgets(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entry_history_entry_id_fkey') then
    alter table public.entry_history
      add constraint entry_history_entry_id_fkey
      foreign key (entry_id) references public.entries(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'savings_goals_budget_id_fkey') then
    alter table public.savings_goals
      add constraint savings_goals_budget_id_fkey
      foreign key (budget_id) references public.budgets(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'savings_goals_user_id_fkey') then
    alter table public.savings_goals
      add constraint savings_goals_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'favorites_category_id_fkey') then
    alter table public.favorites
      add constraint favorites_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'favorites_user_id_fkey') then
    alter table public.favorites
      add constraint favorites_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'net_worth_accounts_user_id_fkey') then
    alter table public.net_worth_accounts
      add constraint net_worth_accounts_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tags_user_id_fkey') then
    alter table public.tags
      add constraint tags_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_user_id_fkey') then
    alter table public.user_preferences
      add constraint user_preferences_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

-- Indexes used by common app queries.
create index if not exists budgets_user_sort_idx on public.budgets (user_id, sort_order);
create index if not exists budgets_parent_id_idx on public.budgets (parent_id);
create index if not exists budgets_user_period_idx on public.budgets (user_id, period);

create index if not exists categories_budget_sort_idx on public.categories (budget_id, sort_order);
create index if not exists categories_budget_name_idx on public.categories (budget_id, name);

create index if not exists entries_budget_sort_idx on public.entries (budget_id, sort_order);
create index if not exists entries_budget_date_idx on public.entries (budget_id, date);
create index if not exists entries_recurring_parent_idx on public.entries (recurring_parent_id);
create index if not exists entries_category_id_idx on public.entries (category_id);

create index if not exists entry_history_budget_timestamp_idx on public.entry_history (budget_id, timestamp);
create index if not exists entry_history_entry_id_idx on public.entry_history (entry_id);

create index if not exists savings_goals_user_idx on public.savings_goals (user_id);
create index if not exists savings_goals_budget_idx on public.savings_goals (budget_id);
create index if not exists favorites_user_idx on public.favorites (user_id);
create index if not exists favorites_category_idx on public.favorites (category_id);
create index if not exists net_worth_accounts_user_idx on public.net_worth_accounts (user_id);
create index if not exists tags_user_name_idx on public.tags (user_id, name);
create index if not exists user_preferences_updated_at_idx on public.user_preferences (updated_at);

commit;
