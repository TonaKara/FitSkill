-- 異議申し立て承認/棄却で transactions.dispute_status を参照・更新するため、
-- 未適用環境でも安全に列と制約を補完する。

alter table public.transactions
  add column if not exists dispute_status text;

alter table public.transactions
  drop constraint if exists transactions_dispute_status_check;

alter table public.transactions
  add constraint transactions_dispute_status_check check (
    dispute_status is null or dispute_status in ('open', 'resolved', 'rejected')
  );

update public.transactions
set dispute_status = 'open'
where disputed_at is not null
  and status = 'disputed'
  and dispute_status is null;
