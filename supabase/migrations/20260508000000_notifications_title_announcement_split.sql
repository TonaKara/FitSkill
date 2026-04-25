-- 通知の件名（お知らせのタイトル等）
alter table public.notifications
  add column if not exists title text;

-- 件名と本文を分け、announcements には管理用の全文（理由行含み）を保存
drop function if exists public.create_announcement_and_notify(text, text, uuid);

create or replace function public.create_announcement_and_notify(
  p_title text,
  p_notification_body text,
  p_announcement_record_content text,
  p_target_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_is_admin boolean;
  v_announcement_id uuid;
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

  insert into public.announcements (created_by, target_user_id, title, content)
  values (v_sender, p_target_user_id, p_title, p_announcement_record_content)
  returning id into v_announcement_id;

  if p_target_user_id is not null then
    if p_target_user_id <> v_sender then
      insert into public.notifications (
        recipient_id,
        sender_id,
        type,
        title,
        content,
        is_admin_origin,
        is_read
      )
      values (
        p_target_user_id,
        v_sender,
        'announcement',
        p_title,
        p_notification_body,
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
      content,
      is_admin_origin,
      is_read
    )
    select
      p.id,
      v_sender,
      'announcement',
      p_title,
      p_notification_body,
      true,
      false
    from public.profiles p
    where p.id <> v_sender;
  end if;

  return v_announcement_id;
end;
$$;

grant execute on function public.create_announcement_and_notify(text, text, text, uuid) to authenticated;
