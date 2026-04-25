-- announcements への書き込みを停止し、管理通知は notifications に一本化する。
drop function if exists public.send_admin_notification(text, text, uuid);

create or replace function public.send_admin_notification(
  p_title text,
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
  v_notif_content text;
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

  v_notif_content := concat('【タイトル】', coalesce(p_title, ''), E'\n', coalesce(p_content, ''));

  if p_target_user_id is not null then
    if p_target_user_id <> v_sender then
      insert into public.notifications (
        recipient_id,
        sender_id,
        type,
        content,
        is_admin_origin,
        is_read
      )
      values (
        p_target_user_id,
        v_sender,
        'announcement',
        v_notif_content,
        true,
        false
      );
    end if;
  else
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      content,
      is_admin_origin,
      is_read
    )
    select
      p.id,
      v_sender,
      'announcement',
      v_notif_content,
      true,
      false
    from public.profiles p
    where p.id <> v_sender;
  end if;
end;
$$;

grant execute on function public.send_admin_notification(text, text, uuid) to authenticated;

-- 互換: 旧 RPC 名は内部で send_admin_notification を呼ぶだけにする（announcements へは書かない）。
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
  perform public.send_admin_notification(p_title, p_content, p_target_user_id);
  v_id := gen_random_uuid();
  return v_id;
end;
$$;

grant execute on function public.create_announcement_and_notify(text, text, uuid) to authenticated;

