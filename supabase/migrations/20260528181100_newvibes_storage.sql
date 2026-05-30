-- =============================================================================
-- FromHere Phase 1: Supabase Storage バケット + ポリシー
-- =============================================================================
-- アプリアイコンとスクリーンショットを別バケットで管理する。
-- パス規則: <maker_uuid>/<product_uuid>.<ext>
-- 例: "12345678-...-89/abcdef-...-01.webp"
-- これにより、アップロード時に「先頭フォルダが自分の uid と一致するか」を検証可。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. バケット作成 / 更新
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'newvibes-app-icons',
    'newvibes-app-icons',
    true,
    1048576, -- 1 MB
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'newvibes-screenshots',
    'newvibes-screenshots',
    true,
    5242880, -- 5 MB
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. 公開 read（誰でも GET 可。バケットが public でも明示的に許可しておく）
-- -----------------------------------------------------------------------------
drop policy if exists "newvibes_storage_public_read" on storage.objects;
create policy "newvibes_storage_public_read"
  on storage.objects for select
  using (
    bucket_id in ('newvibes-app-icons', 'newvibes-screenshots')
  );

-- -----------------------------------------------------------------------------
-- 3. 書き込み系: 認証済みユーザーが自分の uid フォルダ配下にだけ書き込める
-- -----------------------------------------------------------------------------
-- 3-1. INSERT (upload)
drop policy if exists "newvibes_storage_insert_self" on storage.objects;
create policy "newvibes_storage_insert_self"
  on storage.objects for insert
  with check (
    bucket_id in ('newvibes-app-icons', 'newvibes-screenshots')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3-2. UPDATE (move / overwrite)
drop policy if exists "newvibes_storage_update_self" on storage.objects;
create policy "newvibes_storage_update_self"
  on storage.objects for update
  using (
    bucket_id in ('newvibes-app-icons', 'newvibes-screenshots')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('newvibes-app-icons', 'newvibes-screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3-3. DELETE
drop policy if exists "newvibes_storage_delete_self" on storage.objects;
create policy "newvibes_storage_delete_self"
  on storage.objects for delete
  using (
    bucket_id in ('newvibes-app-icons', 'newvibes-screenshots')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
