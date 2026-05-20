-- 管理者: 運営お知らせ（announcement）の更新

drop policy if exists "notifications_admin_announcement_update" on public.notifications;
create policy "notifications_admin_announcement_update"
  on public.notifications for update
  to authenticated
  using (
    is_admin_origin = true
    and type = 'announcement'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    is_admin_origin = true
    and type = 'announcement'
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );
