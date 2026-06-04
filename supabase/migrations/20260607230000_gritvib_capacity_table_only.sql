-- 廃止: 20260607240000_gritvib_capacity_service_role.sql を使用（DATABASE_URL 不要）。
-- GritVib サブスク上限: アプリは PostgREST/RPC を使わず DATABASE_URL で直接 SQL。
-- このファイルを SQL Editor で 1 回実行するだけでよい。

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

comment on table public.gritvib_settings is
  'GritVib 新規サブスク上限（Server Action が DATABASE_URL 経由で読み書き）。';
