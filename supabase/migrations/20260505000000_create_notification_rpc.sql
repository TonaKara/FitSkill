-- 通知挿入用 RPC（RLS より一貫した挿入。呼び出し者は p_sender_id = auth.uid() であること）
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_transaction_id bigint,
  p_sender_id uuid,
  p_type text,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_sender_id is distinct from (select auth.uid()) then
    raise exception 'sender_must_be_caller' using errcode = 'P0001';
  end if;
  if p_recipient_id = p_sender_id then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;
  insert into public.notifications (recipient_id, transaction_id, sender_id, type, content, is_read)
  values (p_recipient_id, p_transaction_id, p_sender_id, p_type, p_content, false);
end;
$$;

grant execute on function public.create_notification(uuid, bigint, uuid, text, text) to authenticated;

create or replace function public.mark_notification_as_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.notifications
  set is_read = true
  where id = p_notification_id
    and recipient_id = (select auth.uid());
end;
$$;

grant execute on function public.mark_notification_as_read(uuid) to authenticated;
