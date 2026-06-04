-- gritvib_settings 一式（テーブル未作成 / schema cache 未反映の修復用）。
-- Supabase SQL Editor でこのファイルを 1 回実行し、続けて Dashboard で schema reload。

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------
create table if not exists public.gritvib_settings (
  id integer primary key default 1,
  subscription_capacity_max integer,
  updated_at timestamptz not null default now(),
  constraint gritvib_settings_singleton_id check (id = 1),
  constraint gritvib_settings_capacity_nonneg check (
    subscription_capacity_max is null or subscription_capacity_max >= 0
  )
);

insert into public.gritvib_settings (id, subscription_capacity_max)
values (1, 0)
on conflict (id) do nothing;

alter table public.gritvib_settings enable row level security;

drop policy if exists gritvib_settings_select_admin on public.gritvib_settings;
create policy gritvib_settings_select_admin
  on public.gritvib_settings for select to authenticated
  using (public.gritvib_is_gritvib_admin());

drop policy if exists gritviv_settings_update_admin on public.gritvib_settings;
drop policy if exists gritvib_settings_update_admin on public.gritvib_settings;
create policy gritvib_settings_update_admin
  on public.gritvib_settings for update to authenticated
  using (public.gritvib_is_gritvib_admin())
  with check (public.gritvib_is_gritvib_admin());

drop policy if exists gritvib_settings_insert_admin on public.gritvib_settings;
create policy gritvib_settings_insert_admin
  on public.gritvib_settings for insert to authenticated
  with check (public.gritvib_is_gritvib_admin());

grant select, insert, update on table public.gritvib_settings to authenticated;
grant select, insert, update, delete on table public.gritvib_settings to service_role;

-- ---------------------------------------------------------------------------
-- RPC（REST の .from('gritvib_settings') は使わず、こちらだけで読み書き）
-- ---------------------------------------------------------------------------
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
    s.subscription_capacity_max as capacity_max,
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

  select s.subscription_capacity_max into v_max
    from public.gritvib_settings s where s.id = 1;

  v_active := public.gritvib_count_active_subscriptions();

  return json_build_object(
    'active_count', v_active,
    'capacity_max', v_max,
    'accepting_new', v_active < coalesce(v_max, 0)
  );
end;
$$;

drop function if exists public.gritvib_admin_save_subscription_capacity_max(integer);

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

  if p_capacity_max < 0 then
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

notify pgrst, 'reload schema';
