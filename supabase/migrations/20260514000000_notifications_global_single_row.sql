-- 全体通知を1行で保持するための正規化。
alter table public.notifications
  add column if not exists is_global boolean not null default false;

alter table public.notifications
  alter column recipient_id drop not null;

-- 受信者本人または全体通知を参照可能にする。
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    or is_global = true
  );

-- 旧定義を置き換え（全体通知時は 1 行だけ INSERT）。
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
  else
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
  end if;
end;
$$;

grant execute on function public.send_admin_notification(text, text, text, uuid) to authenticated;

