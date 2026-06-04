-- GritVib (人間チャットサービス) のメッセージ画像用バケット。
--
-- 設計:
--   - パス形式: {thread_member_id}/{uuid}.{ext}
--   - 最大 5 MB / 画像のみ想定 (アプリ側で content-type を絞る)。
--   - select: 自分のスレッドのもの (= thread_member_id が auth.uid()) と admin。
--   - insert: 自分のスレッドにのみ、サブスク有効時にアップロード可能。
--             admin は任意スレッドにアップロード可能 (operator 添付)。
--   - delete: 自分がアップロードしたファイルのみ。物理削除でメッセージと同じく両側完全削除に対応。

insert into storage.buckets (id, name, public, file_size_limit)
values ('gritvib-chat-photos', 'gritvib-chat-photos', false, 5242880)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    public = excluded.public;

-- select: thread 所有者 or admin
drop policy if exists "gritvib_chat_photos_select" on storage.objects;
create policy "gritvib_chat_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gritvib-chat-photos'
    and (
      name like auth.uid()::text || '/%'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
      )
    )
  );

-- insert (member): 自分のスレッドに、かつサブスクが有効な場合のみ
drop policy if exists "gritvib_chat_photos_insert_member" on storage.objects;
create policy "gritvib_chat_photos_insert_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gritvib-chat-photos'
    and owner = auth.uid()
    and name like auth.uid()::text || '/%'
    and public.gritvib_chat_member_can_send(auth.uid())
  );

-- insert (operator): admin は任意スレッドにアップロード可
drop policy if exists "gritvib_chat_photos_insert_operator" on storage.objects;
create policy "gritvib_chat_photos_insert_operator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gritvib-chat-photos'
    and owner = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- delete: 自分がアップロードしたファイルのみ (両側完全削除のため物理 DELETE)。
drop policy if exists "gritvib_chat_photos_delete_own" on storage.objects;
create policy "gritvib_chat_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gritvib-chat-photos'
    and owner = auth.uid()
  );
