-- 取引チャット添付用バケット（画像・動画・ドキュメント等）
-- パス形式: {transaction_id}/{uuid}_{filename}.{ext}
-- アプリ: src/lib/chat-file-attachments.ts / 取引チャット page

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 52428800)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

drop policy if exists "chat_media_select_participants" on storage.objects;
create policy "chat_media_select_participants"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.transactions t
      where (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
        and name like t.id::text || '/%'
    )
  );

drop policy if exists "chat_media_insert_participants" on storage.objects;
create policy "chat_media_insert_participants"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.transactions t
      where (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
        and name like t.id::text || '/%'
    )
  );
