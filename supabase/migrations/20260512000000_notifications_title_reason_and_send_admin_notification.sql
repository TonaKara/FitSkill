-- notifications を正規化: title / reason / content を分離して保持する。
alter table public.notifications
  add column if not exists title text;

alter table public.notifications
  add column if not exists reason text;

drop function if exists public.send_admin_notification(text, text, uuid);
drop function if exists public.send_admin_notification(text, text, text, uuid);

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
  else
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
  end if;
end;
$$;

grant execute on function public.send_admin_notification(text, text, text, uuid) to authenticated;

-- 互換: 旧RPCは reason を null として新関数へ委譲。
drop function if exists public.create_announcement_and_notify(text, text, uuid);
create or replace function public.create_announcement_and_notify(
  p_title text,
  p_content text,
  p_target_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.send_admin_notification(p_title, null, p_content, p_target_user_id);
  v_id := gen_random_uuid();
  return v_id;
end;
$$;

grant execute on function public.create_announcement_and_notify(text, text, uuid) to authenticated;

