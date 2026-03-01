-- Backfill default categories into all non-folder budgets.
-- Safe to run multiple times (missing names only are inserted).

with defaults(ord, name, color) as (
  values
    (1, 'Shopping', '#f97316'),
    (2, 'Credit', '#ef4444'),
    (3, 'Subscriptions', '#6366f1'),
    (4, 'Debt', '#b91c1c'),
    (5, 'Investing', '#059669'),
    (6, 'Food', '#f59e0b'),
    (7, 'Bill', '#2563eb'),
    (8, 'Other', '#6b7280')
),
target_budgets as (
  select id
  from public.budgets
  where coalesce(is_folder, false) = false
),
existing as (
  select budget_id, lower(trim(name)) as normalized_name
  from public.categories
),
max_sort as (
  select budget_id, coalesce(max(sort_order), -1) as max_sort_order
  from public.categories
  group by budget_id
)
insert into public.categories (budget_id, name, color, icon, budget_limit, sort_order)
select
  b.id as budget_id,
  d.name,
  d.color,
  null as icon,
  null as budget_limit,
  coalesce(ms.max_sort_order, -1)
    + row_number() over (partition by b.id order by d.ord) as sort_order
from target_budgets b
cross join defaults d
left join existing e
  on e.budget_id = b.id
 and e.normalized_name = lower(trim(d.name))
left join max_sort ms
  on ms.budget_id = b.id
where e.budget_id is null;
