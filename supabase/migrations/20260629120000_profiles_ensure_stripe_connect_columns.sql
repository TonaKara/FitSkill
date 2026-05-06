-- profiles 更新時にトリガー等が NEW.stripe_connect_* を参照する一方、
-- カラムが未作成だと 42703「record new has no field ...」になる。
-- 既存マイグレーションと同等の定義を idempotent に再適用する。

alter table public.profiles add column if not exists stripe_connect_account_id text;
alter table public.profiles add column if not exists stripe_connect_charges_enabled boolean;
alter table public.profiles add column if not exists stripe_connect_payouts_enabled boolean;
alter table public.profiles add column if not exists stripe_connect_details_submitted boolean;
alter table public.profiles add column if not exists is_stripe_registered boolean;

create unique index if not exists profiles_stripe_connect_account_id_uidx
  on public.profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
