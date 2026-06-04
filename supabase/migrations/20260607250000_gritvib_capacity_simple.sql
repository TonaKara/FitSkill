-- GritVib サブスク上限（これだけ実行すればよい）。
-- アプリ: 既存の Supabase ログイン + gritvib_settings の SELECT/UPSERT（追加の API キー不要）。

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

-- 会員 UI: 上限人数の参照のみ（1 行・非秘匿）
drop policy if exists gritvib_settings_select_authenticated on public.gritvib_settings;
create policy gritvib_settings_select_authenticated
  on public.gritvib_settings
  for select
  to authenticated
  using (true);

-- 管理画面: 読み書き
drop policy if exists gritvib_settings_select_admin on public.gritvib_settings;
create policy gritvib_settings_select_admin
  on public.gritvib_settings
  for select
  to authenticated
  using (public.gritvib_is_gritvib_admin());

drop policy if exists gritvib_settings_insert_admin on public.gritvib_settings;
create policy gritvib_settings_insert_admin
  on public.gritvib_settings
  for insert
  to authenticated
  with check (public.gritvib_is_gritvib_admin());

drop policy if exists gritvib_settings_update_admin on public.gritvib_settings;
create policy gritvib_settings_update_admin
  on public.gritvib_settings
  for update
  to authenticated
  using (public.gritvib_is_gritvib_admin())
  with check (public.gritvib_is_gritvib_admin());

grant select, insert, update on table public.gritvib_settings to authenticated;

-- 有効人数カウント（会員は RPC のみ・全件 SELECT 不要）
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
