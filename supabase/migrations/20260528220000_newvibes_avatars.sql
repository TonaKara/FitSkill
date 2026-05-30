-- =============================================================================
-- FromHere Phase E: ユーザーアバター画像のアップロード
-- =============================================================================
-- - `newvibes_profiles` に `avatar_path` カラムを追加。
--   旧 `avatar_url` は外部 URL 用に残す（将来削除する想定だが、互換のため共存）。
-- - 新規 Storage バケット `newvibes-avatars` を作成。
--   パス規則: <uid>/<filename>.<ext>
-- - 書き込みは自分の uid フォルダのみ、読み出しは public。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. プロフィールテーブルへ avatar_path を追加
-- -----------------------------------------------------------------------------
alter table public.newvibes_profiles
  add column if not exists avatar_path text
    check (avatar_path is null or char_length(avatar_path) <= 500);

comment on column public.newvibes_profiles.avatar_path is
  'Storage bucket "newvibes-avatars" 内のオブジェクトパス。形式: <uid>/<filename>.<ext>';

-- -----------------------------------------------------------------------------
-- 2. Storage バケットの作成 / 更新
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'newvibes-avatars',
    'newvibes-avatars',
    true,
    2097152, -- 2 MB
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 3. 公開 read（誰でも GET 可。バケットが public でも明示的に許可しておく）
-- -----------------------------------------------------------------------------
drop policy if exists "newvibes_avatars_public_read" on storage.objects;
create policy "newvibes_avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'newvibes-avatars');

-- -----------------------------------------------------------------------------
-- 4. 書き込み系: 認証済みユーザーが自分の uid フォルダ配下にだけ書き込める
-- -----------------------------------------------------------------------------
-- 4-1. INSERT (upload)
drop policy if exists "newvibes_avatars_insert_self" on storage.objects;
create policy "newvibes_avatars_insert_self"
  on storage.objects for insert
  with check (
    bucket_id = 'newvibes-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4-2. UPDATE (move / overwrite)
drop policy if exists "newvibes_avatars_update_self" on storage.objects;
create policy "newvibes_avatars_update_self"
  on storage.objects for update
  using (
    bucket_id = 'newvibes-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'newvibes-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4-3. DELETE
drop policy if exists "newvibes_avatars_delete_self" on storage.objects;
create policy "newvibes_avatars_delete_self"
  on storage.objects for delete
  using (
    bucket_id = 'newvibes-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
