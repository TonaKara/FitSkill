-- Stripe Webhook のイベント ID を記録し、再送時の二重処理を防ぐ。
-- Next.js の app/api/webhook/stripe が service_role で insert する。

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  received_at timestamptz not null default now(),
  constraint stripe_webhook_events_id_not_blank check (char_length(trim(stripe_event_id)) > 0)
);

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon;
revoke all on table public.stripe_webhook_events from authenticated;
grant select, insert on table public.stripe_webhook_events to service_role;
