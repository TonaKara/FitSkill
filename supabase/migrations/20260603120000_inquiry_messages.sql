-- 取引前の出品者・受講希望者間チャット（transactions / messages とは独立）

create table if not exists public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  origin_skill_id bigint not null references public.skills (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint inquiry_messages_buyer_not_seller check (buyer_id <> seller_id)
);

create index if not exists inquiry_messages_thread_created_idx
  on public.inquiry_messages (buyer_id, seller_id, created_at desc);

create index if not exists inquiry_messages_seller_idx
  on public.inquiry_messages (seller_id, created_at desc);

create index if not exists inquiry_messages_buyer_idx
  on public.inquiry_messages (buyer_id, created_at desc);

alter table public.inquiry_messages enable row level security;

drop policy if exists "inquiry_messages_select_parties" on public.inquiry_messages;
create policy "inquiry_messages_select_parties"
  on public.inquiry_messages for select
  to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

drop policy if exists "inquiry_messages_insert_parties" on public.inquiry_messages;
create policy "inquiry_messages_insert_parties"
  on public.inquiry_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
    and buyer_id <> seller_id
    and exists (
      select 1
      from public.skills s
      where s.id = origin_skill_id
        and s.user_id = seller_id
    )
  );

-- スレッド一覧: 参加中の (buyer_id, seller_id) ごとに最新 1 件
create or replace function public.inquiry_inbox_threads()
returns table (
  buyer_id uuid,
  seller_id uuid,
  peer_id uuid,
  last_created_at timestamptz,
  last_content text,
  last_origin_skill_id bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.buyer_id, m.seller_id)
    m.buyer_id,
    m.seller_id,
    case
      when m.buyer_id = (select auth.uid()) then m.seller_id
      else m.buyer_id
    end as peer_id,
    m.created_at,
    m.content,
    m.origin_skill_id
  from public.inquiry_messages m
  where m.buyer_id = (select auth.uid()) or m.seller_id = (select auth.uid())
  order by m.buyer_id, m.seller_id, m.created_at desc;
$$;

grant execute on function public.inquiry_inbox_threads() to authenticated;
