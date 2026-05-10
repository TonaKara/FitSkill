-- 全体配信は recipient_id = null・is_global = true の 1 行のみ（20260515000000 の意図を維持）。
-- notifications_insert_as_sender は recipient_id IS NOT NULL のため、全体 1 行用の INSERT ポリシーを別途追加する。
-- send_admin_notification(text, text, uuid) が残ると RPC 解決が不安定なため削除する。

alter table public.notifications
  add column if not exists is_global boolean not null default false;

drop policy if exists "notifications_insert_admin_global_announcement" on public.notifications;
create policy "notifications_insert_admin_global_announcement"
  on public.notifications for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id is null
    and is_global = true
    and type = 'announcement'
    and is_admin_origin = true
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );

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
    return;
  end if;

  -- 全体配信: テーブル上は 1 行のみ
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
end;
$$;

grant execute on function public.send_admin_notification(text, text, text, uuid) to authenticated;
