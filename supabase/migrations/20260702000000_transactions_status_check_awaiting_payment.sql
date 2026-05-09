-- 決済待ち取引（awaiting_payment）を許可する。
-- リモートDBで 20260625100000_stripe_connect_and_payment が未適用の場合、
-- INSERT 時に transactions_status_check 違反になるため、最終状態をここで保証する。

alter table public.transactions drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check check (
    status in (
      'awaiting_payment',
      'pending',
      'in_progress',
      'active',
      'completed',
      'approval_pending',
      'disputed',
      'refunded',
      'canceled'
    )
  );
