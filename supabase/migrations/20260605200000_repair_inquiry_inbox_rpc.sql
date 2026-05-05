-- 相談インボックス用 RPC が未作成／PostgREST schema cache と不整合な環境の修復（冪等）
-- 既に 20260605100000 で適用済みでも create or replace で上書き可能

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
