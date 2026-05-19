-- 管理者: 通報テーブルの参照・ステータス更新

drop policy if exists "user_reports_select_admin" on public.user_reports;
create policy "user_reports_select_admin"
  on public.user_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "user_reports_update_admin" on public.user_reports;
create policy "user_reports_update_admin"
  on public.user_reports for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "product_reports_select_admin" on public.product_reports;
create policy "product_reports_select_admin"
  on public.product_reports for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "product_reports_update_admin" on public.product_reports;
create policy "product_reports_update_admin"
  on public.product_reports for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and coalesce(p.is_admin, false) = true
    )
  );
