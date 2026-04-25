-- 運営承認（返金・キャンセル）用の取引ステータス

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (
    status in (
      'active',
      'completed',
      'approval_pending',
      'disputed',
      'refunded',
      'canceled'
    )
  );
