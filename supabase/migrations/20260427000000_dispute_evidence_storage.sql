-- 異議申し立ての証拠画像用ストレージ
-- アプリ側キー形式: {auth.uid()}/{transaction_id}/{timestamp}_{filename}
-- バケット名は src/app/chat/[transaction_id]/page.tsx の DISPUTE_EVIDENCE_BUCKET と一致させる

insert into storage.buckets (id, name, public, file_size_limit)
values ('dispute-evidence', 'dispute-evidence', true, 10485760)
on conflict (id) do nothing;

drop policy if exists "dispute_evidence_insert_party" on storage.objects;
create policy "dispute_evidence_insert_party"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dispute-evidence'
  and exists (
    select 1
    from public.transactions t
    where (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
      and name like auth.uid()::text || '/' || t.id::text || '/%'
  )
);
