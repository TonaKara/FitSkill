-- inquiry_messages: buyer/seller から sender/recipient + is_read へ移行

drop function if exists public.inquiry_inbox_threads();

drop policy if exists "inquiry_messages_select_parties" on public.inquiry_messages;
drop policy if exists "inquiry_messages_insert_parties" on public.inquiry_messages;
drop policy if exists "inquiry_messages_update_recipient_read" on public.inquiry_messages;

drop trigger if exists inquiry_messages_limit_update on public.inquiry_messages;
drop function if exists public.inquiry_messages_limit_update_to_read();

alter table public.inquiry_messages add column if not exists recipient_id uuid references auth.users (id) on delete cascade;
alter table public.inquiry_messages add column if not exists is_read boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inquiry_messages'
      and column_name = 'buyer_id'
  ) then
    update public.inquiry_messages m
    set recipient_id = case
      when m.sender_id = m.buyer_id then m.seller_id
      else m.buyer_id
    end
    where m.recipient_id is null;
  end if;
end $$;

alter table public.inquiry_messages alter column recipient_id set not null;

alter table public.inquiry_messages drop constraint if exists inquiry_messages_buyer_not_seller;
alter table public.inquiry_messages drop constraint if exists inquiry_messages_buyer_id_fkey;
alter table public.inquiry_messages drop constraint if exists inquiry_messages_seller_id_fkey;

alter table public.inquiry_messages drop column if exists buyer_id;
alter table public.inquiry_messages drop column if exists seller_id;

alter table public.inquiry_messages drop constraint if exists inquiry_messages_sender_recipient_check;
alter table public.inquiry_messages
  add constraint inquiry_messages_sender_recipient_check check (sender_id <> recipient_id);

drop index if exists inquiry_messages_thread_created_idx;
drop index if exists inquiry_messages_seller_idx;
drop index if exists inquiry_messages_buyer_idx;

create index if not exists inquiry_messages_pair_created_idx
  on public.inquiry_messages (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id),
    created_at desc
  );

create index if not exists inquiry_messages_sender_created_idx
  on public.inquiry_messages (sender_id, created_at desc);

create index if not exists inquiry_messages_recipient_created_idx
  on public.inquiry_messages (recipient_id, created_at desc);

create index if not exists inquiry_messages_recipient_unread_idx
  on public.inquiry_messages (recipient_id, is_read)
  where is_read = false;

alter table public.inquiry_messages enable row level security;

create policy "inquiry_messages_select_parties"
  on public.inquiry_messages for select
  to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy "inquiry_messages_insert_sender"
  on public.inquiry_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
    and exists (
      select 1
      from public.skills s
      where s.id = origin_skill_id
        and (s.user_id = recipient_id or s.user_id = sender_id)
    )
  );

create policy "inquiry_messages_update_recipient_read"
  on public.inquiry_messages for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.inquiry_messages_limit_update_to_read()
returns trigger
language plpgsql
as $$
begin
  if (
    new.id is distinct from old.id
    or new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.origin_skill_id is distinct from old.origin_skill_id
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'inquiry_messages: only is_read may be updated';
  end if;
  return new;
end;
$$;

create trigger inquiry_messages_limit_update
  before update on public.inquiry_messages
  for each row
  execute function public.inquiry_messages_limit_update_to_read();

-- 相手ごとの最新 1 件（一覧用）
create or replace function public.inquiry_inbox_list()
returns table (
  peer_id uuid,
  last_created_at timestamptz,
  last_content text,
  last_origin_skill_id bigint,
  last_is_read boolean,
  last_sender_id uuid,
  last_recipient_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  with pairs as (
    select
      m.id,
      m.sender_id,
      m.recipient_id,
      m.content,
      m.created_at,
      m.origin_skill_id,
      m.is_read,
      case
        when m.sender_id = (select auth.uid()) then m.recipient_id
        else m.sender_id
      end as peer_id
    from public.inquiry_messages m
    where m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid())
  ),
  ranked as (
    select
      peer_id,
      content,
      created_at,
      origin_skill_id,
      is_read,
      sender_id,
      recipient_id,
      row_number() over (partition by peer_id order by created_at desc) as rn
    from pairs
  )
  select
    ranked.peer_id,
    ranked.created_at as last_created_at,
    ranked.content as last_content,
    ranked.origin_skill_id as last_origin_skill_id,
    ranked.is_read as last_is_read,
    ranked.sender_id as last_sender_id,
    ranked.recipient_id as last_recipient_id
  from ranked
  where ranked.rn = 1;
$$;

grant execute on function public.inquiry_inbox_list() to authenticated;

-- 1対1スレッドの全メッセージ（作成日時昇順）
create or replace function public.inquiry_thread_messages(p_peer_id uuid)
returns setof public.inquiry_messages
language sql
stable
security invoker
set search_path = public
as $$
  select m.*
  from public.inquiry_messages m
  where
    (m.sender_id = (select auth.uid()) and m.recipient_id = p_peer_id)
    or (m.sender_id = p_peer_id and m.recipient_id = (select auth.uid()))
  order by m.created_at asc;
$$;

grant execute on function public.inquiry_thread_messages(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.inquiry_messages;
exception
  when duplicate_object then null;
end $$;

alter table public.inquiry_messages replica identity full;
