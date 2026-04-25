-- 取引・チャット向け in-app 通知
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  transaction_id bigint references public.transactions (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  type text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "notifications_update_own_read" on public.notifications;
create policy "notifications_update_own_read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists "notifications_insert_as_sender" on public.notifications;
create policy "notifications_insert_as_sender"
  on public.notifications for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id is not null
    and sender_id <> recipient_id
  );

alter publication supabase_realtime add table public.notifications;
