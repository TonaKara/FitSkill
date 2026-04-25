-- 通報テーブルの INSERT を認証ユーザーに限定

alter table public.user_reports enable row level security;
alter table public.product_reports enable row level security;

drop policy if exists "user_reports_insert_authenticated" on public.user_reports;
create policy "user_reports_insert_authenticated"
  on public.user_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "product_reports_insert_authenticated" on public.product_reports;
create policy "product_reports_insert_authenticated"
  on public.product_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);
