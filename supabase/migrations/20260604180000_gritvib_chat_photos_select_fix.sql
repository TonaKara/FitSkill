-- GritVib チャット画像: SELECT ポリシーを安定した条件に戻す。
-- foldername 依存をやめ、従来の prefix + メッセージ紐づけ + 管理者でカバーする。

drop policy if exists "gritvib_chat_photos_select" on storage.objects;
create policy "gritvib_chat_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gritvib-chat-photos'
    and (
      public.gritvib_is_gritvib_admin()
      or name like auth.uid()::text || '/%'
      or exists (
        select 1
        from public.gritvib_chat_messages m
        where m.thread_member_id = auth.uid()
          and m.image_path = name
      )
    )
  );
