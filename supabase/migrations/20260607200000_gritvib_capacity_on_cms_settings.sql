-- 廃止: 20260607220000_gritvib_capacity_rpc_only.sql を使うこと（PostgREST の列 cache 問題のため）。
-- cms_settings が無い環境向け: テーブル作成〜 GritVib 上限列まで一括。
-- 既に cms_settings がある場合も add column if not exists で安全に再実行可。

create table if not exists public.cms_settings (
  id integer primary key,
  site_name text not null default '',
  operations_manager text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  price_info text not null default '',
  payment_method text not null default '',
  delivery_info text not null default '',
  return_policy text not null default '',
  refund_policy text not null default '',
  service_terms text not null default '',
  gritvib_subscription_capacity_max integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_settings_singleton_id check (id = 1),
  constraint cms_settings_gritvib_capacity_nonneg check (gritvib_subscription_capacity_max >= 0)
);

-- 古い定義から作られたテーブル用（列だけ足す）
alter table public.cms_settings
  add column if not exists operations_manager text not null default '';

alter table public.cms_settings
  add column if not exists gritvib_subscription_capacity_max integer not null default 0;

alter table public.cms_settings enable row level security;

drop policy if exists "cms_settings_select_all" on public.cms_settings;
create policy "cms_settings_select_all"
  on public.cms_settings
  for select
  using (true);

drop policy if exists "cms_settings_insert_admin" on public.cms_settings;
create policy "cms_settings_insert_admin"
  on public.cms_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "cms_settings_update_admin" on public.cms_settings;
create policy "cms_settings_update_admin"
  on public.cms_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

insert into public.cms_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.cms_settings
  drop constraint if exists cms_settings_gritvib_capacity_nonneg;

alter table public.cms_settings
  add constraint cms_settings_gritvib_capacity_nonneg
  check (gritvib_subscription_capacity_max >= 0);

comment on column public.cms_settings.gritvib_subscription_capacity_max is
  'GritVib 新規サブスクの上限人数。0 は新規受付停止（表示上）。';

comment on column public.cms_settings.operations_manager is
  '特定商取引法に基づく表記の「運営責任者」。';
