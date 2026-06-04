-- GritVib サブスク上限: テーブルは Postgres にだけ作る（PostgREST / schema cache は使わない）。
-- アプリは Server Action → pg 直結（SUPABASE_DB_PASSWORD または DATABASE_URL）。

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

update public.gritvib_settings
set subscription_capacity_max = coalesce(subscription_capacity_max, 0)
where id = 1;

alter table public.gritvib_settings enable row level security;

-- 通常ユーザーの JWT からは触らせない（Server Action が service_role で操作）
revoke all on table public.gritvib_settings from anon;
revoke all on table public.gritvib_settings from authenticated;
grant all on table public.gritvib_settings to service_role;

comment on table public.gritvib_settings is
  'GritVib 新規サブスク上限。アプリは Postgres 直結のみ（Supabase REST API 非使用）。';
