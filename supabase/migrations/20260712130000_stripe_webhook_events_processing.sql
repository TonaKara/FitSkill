-- Webhook 処理完了後にのみ processed_at を付与し、失敗時は Stripe 再送で再処理できるようにする。

alter table public.stripe_webhook_events
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text;

create index if not exists stripe_webhook_events_unprocessed_idx
  on public.stripe_webhook_events (received_at desc)
  where processed_at is null;

grant update on table public.stripe_webhook_events to service_role;

revoke all on function public.complete_transaction(int8) from public;
revoke all on function public.complete_transaction(int8) from anon;
revoke all on function public.complete_transaction(int8) from authenticated;
grant execute on function public.complete_transaction(int8) to service_role;
