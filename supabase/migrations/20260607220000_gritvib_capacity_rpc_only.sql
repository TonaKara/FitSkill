-- 廃止: アプリは 20260607230000 + DATABASE_URL 直結 SQL を使用（PostgREST/RPC も使わない）。
-- GritVib サブスク上限: REST の .from('cms_settings'|'gritvib_settings') は使わない。
-- アプリは RPC のみ。テーブルは DB 内だけで参照（authenticated からの直接 GRANT なし）。

create table if not exists public.gritvib_settings (
  id integer primary key default 1,
  subscription_capacity_max integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint gritvib_settings_singleton_id check (id = 1),
  constraint gritvib_settings_capacity_nonneg check (subscription_capacity_max >= 0)
);

insert into public.gritvib_settings (id, subscription_capacity_max)
values (1, 0)
on conflict (id) do nothing;

alter table public.gritvib_settings enable row level security;

-- cms_settings 経由をやめる（テーブル・列がある場合のみ削除）
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_settings'
      and column_name = 'gritvib_subscription_capacity_max'
  ) then
    alter table public.cms_settings
      drop column gritvib_subscription_capacity_max;
  end if;
end $$;

update public.gritvib_settings
set subscription_capacity_max = coalesce(subscription_capacity_max, 0)
where id = 1;

create or replace function public.gritvib_count_active_subscriptions()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.gritvib_chat_members m
  where m.subscription_status in ('active', 'trialing')
    and (
      m.subscription_current_period_end is null
      or m.subscription_current_period_end > now()
    );
$$;

create or replace function public.gritvib_get_subscription_capacity_status()
returns table (
  active_count bigint,
  capacity_max integer,
  accepting_new boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.gritvib_count_active_subscriptions() as active_count,
    coalesce(s.subscription_capacity_max, 0) as capacity_max,
    (
      public.gritvib_count_active_subscriptions()
      < coalesce(s.subscription_capacity_max, 0)
    ) as accepting_new
  from (select 1) as _singleton
  left join public.gritvib_settings s on s.id = 1;
$$;

create or replace function public.gritvib_admin_subscription_capacity_snapshot()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_active bigint;
begin
  if not public.gritvib_is_gritvib_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(s.subscription_capacity_max, 0) into v_max
  from public.gritvib_settings s
  where s.id = 1;

  if v_max is null then
    v_max := 0;
  end if;

  v_active := public.gritvib_count_active_subscriptions();

  return json_build_object(
    'active_count', v_active,
    'capacity_max', v_max,
    'accepting_new', v_active < v_max
  );
end;
$$;

drop function if exists public.gritvib_admin_save_subscription_capacity_max(integer);
drop function if exists public.gritvib_admin_set_subscription_capacity_max(integer);

create function public.gritvib_admin_save_subscription_capacity_max(
  p_capacity_max integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gritvib_is_gritvib_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_capacity_max is null or p_capacity_max < 0 then
    raise exception 'invalid_capacity' using errcode = '22023';
  end if;

  insert into public.gritvib_settings (id, subscription_capacity_max, updated_at)
  values (1, p_capacity_max, now())
  on conflict (id) do update
  set
    subscription_capacity_max = excluded.subscription_capacity_max,
    updated_at = excluded.updated_at;

  return p_capacity_max;
end;
$$;

revoke all on table public.gritvib_settings from anon;
revoke all on table public.gritvib_settings from authenticated;
grant all on table public.gritvib_settings to service_role;

revoke all on function public.gritvib_count_active_subscriptions() from public;
grant execute on function public.gritvib_count_active_subscriptions() to authenticated;
grant execute on function public.gritvib_count_active_subscriptions() to service_role;

revoke all on function public.gritvib_get_subscription_capacity_status() from public;
grant execute on function public.gritvib_get_subscription_capacity_status() to authenticated;
grant execute on function public.gritvib_get_subscription_capacity_status() to service_role;

revoke all on function public.gritvib_admin_subscription_capacity_snapshot() from public;
revoke all on function public.gritvib_admin_subscription_capacity_snapshot() from anon;
grant execute on function public.gritvib_admin_subscription_capacity_snapshot() to authenticated;
grant execute on function public.gritvib_admin_subscription_capacity_snapshot() to service_role;

revoke all on function public.gritvib_admin_save_subscription_capacity_max(integer) from public;
revoke all on function public.gritvib_admin_save_subscription_capacity_max(integer) from anon;
grant execute on function public.gritvib_admin_save_subscription_capacity_max(integer) to authenticated;
grant execute on function public.gritvib_admin_save_subscription_capacity_max(integer) to service_role;
