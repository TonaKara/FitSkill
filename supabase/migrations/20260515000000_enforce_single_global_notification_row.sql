-- 全体通知は recipient_id を持たない 1 行だけ保存する（ループ禁止）。
-- 既存定義を上書きして、profiles 全件走査の余地をなくす。

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

  if p_target_user_id is null then
    -- 全体通知: 1 行のみ
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      reason,
      content,
      is_global,
      is_admin_origin,
      is_read
    )
    values (
      null,
      v_sender,
      'announcement',
      p_title,
      p_reason,
      p_content,
      true,
      true,
      false
    );
    return;
  end if;

  -- 個別通知: 指定ユーザーに 1 行のみ
  if p_target_user_id <> v_sender then
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      reason,
      content,
      is_global,
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
      false,
      true,
      false
    );
  end if;
end;
$$;

grant execute on function public.send_admin_notification(text, text, text, uuid) to authenticated;

