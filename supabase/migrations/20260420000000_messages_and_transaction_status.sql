-- チャット用: messages テーブル、transactions.status、price 補完（未設定時）

alter table public.transactions add column if not exists status text not null default 'active';

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (status in ('active', 'completed'));

alter table public.transactions add column if not exists price integer;

update public.transactions t
set price = s.price
from public.skills s
where t.skill_id = s.id and t.price is null;

update public.transactions set price = 0 where price is null;

alter table public.transactions alter column price set not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_transaction_id_created_at_idx
  on public.messages (transaction_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = messages.transaction_id
        and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
    )
  );

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
    )
  );

drop policy if exists "transactions_update_seller" on public.transactions;
create policy "transactions_update_seller"
  on public.transactions for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);
