-- Removes previously seeded demo data inserted by /api/dev/seed-fake-data.
-- Safe to run multiple times, even if tags/tag_ids do not exist.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'entries'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tags'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'tag_ids'
  ) then
    with seed_tags as (
      select id
      from public.tags
      where lower(name) = 'seed-demo'
    )
    update public.entries
    set tag_ids = (
      select array_agg(tag_id)
      from unnest(coalesce(tag_ids, '{}'::integer[])) as tag_id
      where tag_id not in (select id from seed_tags)
    )
    where tag_ids is not null
      and exists (
        select 1
        from seed_tags st
        where st.id = any(public.entries.tag_ids)
      );
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'note'
  ) then
    delete from public.entries
    where coalesce(note, '') ilike '%[seed-demo]%';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tags'
  ) then
    delete from public.tags
    where lower(name) = 'seed-demo';
  end if;

  -- Remove leftover legacy development records from pre-auth testing.
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'budgets'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budgets'
      and column_name = 'user_id'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'entry_history'
    )
    and exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'entries'
    ) then
      delete from public.entry_history
      where budget_id in (
        select id from public.budgets where user_id = 'local-dev-user'
      );
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'entries'
    ) then
      delete from public.entries
      where budget_id in (
        select id from public.budgets where user_id = 'local-dev-user'
      );
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'categories'
    ) then
      delete from public.categories
      where budget_id in (
        select id from public.budgets where user_id = 'local-dev-user'
      );
    end if;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'savings_goals'
    ) then
      delete from public.savings_goals
      where coalesce(user_id, '') = 'local-dev-user'
         or budget_id in (
           select id from public.budgets where user_id = 'local-dev-user'
         );
    end if;

    delete from public.budgets
    where user_id = 'local-dev-user';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'favorites'
  ) then
    delete from public.favorites
    where coalesce(user_id, '') = 'local-dev-user';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'net_worth_accounts'
  ) then
    delete from public.net_worth_accounts
    where coalesce(user_id, '') = 'local-dev-user';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_preferences'
  ) then
    delete from public.user_preferences
    where user_id = 'local-dev-user';
  end if;
end $$;

commit;
