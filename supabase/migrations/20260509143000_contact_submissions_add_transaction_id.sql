-- お問い合わせフォームに取引ID（任意）を保存するためのカラム追加
alter table if exists public.contact_submissions
  add column if not exists transaction_id text;
