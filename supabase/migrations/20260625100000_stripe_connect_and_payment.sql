-- Stripe Connect / PaymentIntent 連携用

alter table public.profiles add column if not exists stripe_connect_account_id text;
alter table public.profiles add column if not exists stripe_connect_charges_enabled boolean;
alter table public.profiles add column if not exists stripe_connect_payouts_enabled boolean;
alter table public.profiles add column if not exists stripe_connect_details_submitted boolean;

create unique index if not exists profiles_stripe_connect_account_id_uidx
  on public.profiles (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

alter table public.transactions add column if not exists stripe_payment_intent_id text;

create unique index if not exists transactions_stripe_payment_intent_id_uidx
  on public.transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

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
