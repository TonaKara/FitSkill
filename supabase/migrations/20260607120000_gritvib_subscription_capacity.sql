-- GritVib: サブスク有効人数の上限（運営が管理画面で設定。新規申込 UI のみに利用）。
-- 満員判定は参考程度。Webhook では弾かず、決済完了者は従来どおり有効化する。

create table if not exists public.gritvib_settings (
  id integer primary key default 1,
  subscription_capacity_max integer,
  updated_at timestamptz not null default now(),
  constraint gritvib_settings_singleton_id check (id = 1),
  constraint gritvib_settings_capacity_nonneg check (
    subscription_capacity_max is null or subscription_capacity_max >= 0
  )
);

comment on table public.gritvib_settings is
  'GritVib 運営向けの単一設定行。subscription_capacity_max が NULL のとき新規枠は無制限。';
comment on column public.gritvib_settings.subscription_capacity_max is
  'サブスク有効（active/trialing かつ期間内）の上限人数。NULL は無制限。';

insert into public.gritvib_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.gritvib_settings enable row level security;

drop policy if exists gritvib_settings_select_admin on public.gritvib_settings;
create policy gritvib_settings_select_admin
  on public.gritvib_settings
  for select
  to authenticated
  using (public.gritvib_is_gritvib_admin());

drop policy if exists gritvib_settings_update_admin on public.gritvib_settings;
create policy gritvib_settings_update_admin
  on public.gritvib_settings
  for update
  to authenticated
  using (public.gritvib_is_gritvib_admin())
  with check (public.gritvib_is_gritvib_admin());

revoke all on table public.gritvib_settings from anon;
grant select, update on table public.gritvib_settings to authenticated;

-- gritvib_chat_member_can_send と同じ「有効サブスク」の定義で人数を数える。
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

revoke all on function public.gritvib_count_active_subscriptions() from public;
grant execute on function public.gritvib_count_active_subscriptions() to authenticated;

comment on function public.gritvib_count_active_subscriptions() is
  'GritVib の現在有効なサブスク会員数（active/trialing かつ期間内）。';

-- 会員向け UI: 現在有効人数・上限・新規受付可否。
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
      s.subscription_capacity_max is null
      or public.gritvib_count_active_subscriptions() < s.subscription_capacity_max
    ) as accepting_new
  from public.gritvib_settings s
  where s.id = 1;
$$;

revoke all on function public.gritvib_get_subscription_capacity_status() from public;
grant execute on function public.gritvib_get_subscription_capacity_status() to authenticated;

comment on function public.gritvib_get_subscription_capacity_status() is
  'GritVib 新規サブスク受付可否。active_count >= capacity_max のとき accepting_new = false（同時決済で上限超えは許容）。';
