-- 管理画面から gritvib_settings 行を初回作成できるよう INSERT を許可。

grant insert on table public.gritvib_settings to authenticated;

drop policy if exists gritvib_settings_insert_admin on public.gritvib_settings;
create policy gritvib_settings_insert_admin
  on public.gritvib_settings
  for insert
  to authenticated
  with check (public.gritvib_is_gritvib_admin());
