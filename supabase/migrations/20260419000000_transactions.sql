-- transactions: スキル購入（決済なしの取引開始）
-- Supabase SQL Editor で実行するか、CLI で適用してください。

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint transactions_buyer_not_seller check (buyer_id <> seller_id)
);

create index if not exists transactions_buyer_id_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_id_idx on public.transactions (seller_id);
create index if not exists transactions_skill_id_idx on public.transactions (skill_id);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_parties" on public.transactions;
create policy "transactions_select_parties"
  on public.transactions for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "transactions_insert_as_buyer" on public.transactions;
create policy "transactions_insert_as_buyer"
  on public.transactions for insert
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
  );
