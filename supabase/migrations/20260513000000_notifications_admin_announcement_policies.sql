-- 管理画面「お知らせ」タブ用:
-- 管理者が運営起点のお知らせ通知（announcement）の一覧取得・削除をできるようにする。

drop policy if exists "notifications_admin_announcement_select" on public.notifications;
create policy "notifications_admin_announcement_select"
  on public.notifications for select
  to authenticated
  using (
    is_admin_origin = true
    and type = 'announcement'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "notifications_admin_announcement_delete" on public.notifications;
create policy "notifications_admin_announcement_delete"
  on public.notifications for delete
  to authenticated
  using (
    is_admin_origin = true
    and type = 'announcement'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

