-- notifications テーブル再構築後の関数定義。
-- 旧カラム（transaction_id / is_global）を参照しない。

drop function if exists public.create_admin_notification(uuid, bigint, text, text);
drop function if exists public.create_admin_notification(uuid, text, text);
drop function if exists public.send_admin_notification(text, text, text, uuid);

create or replace function public.create_admin_notification(
  p_recipient_id uuid,
  p_type text,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_is_admin boolean;
begin
  v_sender := auth.uid();
  if v_sender is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select coalesce(p.is_admin, false)
  into v_is_admin
  from public.profiles p
  where p.id = v_sender;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  if p_recipient_id = v_sender then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;

  insert into public.notifications (
    recipient_id,
    sender_id,
    type,
    title,
    reason,
    content,
    is_admin_origin,
    is_read
  )
  values (
    p_recipient_id,
    v_sender,
    p_type,
    null,
    null,
    p_content,
    true,
    false
  );
end;
$$;

grant execute on function public.create_admin_notification(uuid, text, text) to authenticated;

create or replace function public.send_admin_notification(
  p_title text,
  p_reason text,
  p_content text,
  p_target_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_is_admin boolean;
begin
  v_sender := auth.uid();
  if v_sender is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select coalesce(p.is_admin, false)
  into v_is_admin
  from public.profiles p
  where p.id = v_sender;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  if p_target_user_id is not null then
    if p_target_user_id <> v_sender then
      insert into public.notifications (
        recipient_id,
        sender_id,
        type,
        title,
        reason,
        content,
        is_admin_origin,
        is_read
      )
      values (
        p_target_user_id,
        v_sender,
        'announcement',
        p_title,
        p_reason,
        p_content,
        true,
        false
      );
    end if;
    return;
  end if;

  insert into public.notifications (
    recipient_id,
    sender_id,
    type,
    title,
    reason,
    content,
    is_admin_origin,
    is_read
  )
  select
    p.id,
    v_sender,
    'announcement',
    p_title,
    p_reason,
    p_content,
    true,
    false
  from public.profiles p
  where p.id <> v_sender;
end;
$$;

grant execute on function public.send_admin_notification(text, text, text, uuid) to authenticated;
