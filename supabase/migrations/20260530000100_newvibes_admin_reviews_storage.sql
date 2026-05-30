-- =============================================================================
-- FromHere: 運営レビュー用アイコン画像ストレージ
-- =============================================================================
-- - バケット `newvibes-admin-review-icons` を public-read で作成。
-- - 書き込み (insert/update/delete) は profiles.is_admin = true の管理者のみ。
-- - パス規約: <slug>/<uuid>.<ext> もしくは <uuid>.<ext>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'newvibes-admin-review-icons',
    'newvibes-admin-review-icons',
    true,
    2097152, -- 2 MB
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 公開 read（誰でも GET 可。バケットが public でも明示的に許可しておく）
drop policy if exists "newvibes_admin_review_icons_public_read" on storage.objects;
create policy "newvibes_admin_review_icons_public_read"
  on storage.objects for select
  using (bucket_id = 'newvibes-admin-review-icons');

-- 書き込みは管理者のみ
drop policy if exists "newvibes_admin_review_icons_insert_admin" on storage.objects;
create policy "newvibes_admin_review_icons_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'newvibes-admin-review-icons'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "newvibes_admin_review_icons_update_admin" on storage.objects;
create policy "newvibes_admin_review_icons_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'newvibes-admin-review-icons'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    bucket_id = 'newvibes-admin-review-icons'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "newvibes_admin_review_icons_delete_admin" on storage.objects;
create policy "newvibes_admin_review_icons_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'newvibes-admin-review-icons'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
