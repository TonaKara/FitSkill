-- GritVib (人間チャットサービス) と Stripe を連携するための拡張。
--
-- 設計:
--   - `stripe_customer_id`: Stripe Customer ID を会員レコードに紐づけ、Webhook では
--     customer ID で逆引きできるようにする。初回 checkout.session.completed の
--     ハンドラで email → user_id を解決し、その時点で保存する。
--   - email -> user_id 解決のため `gritvib_resolve_user_id_by_email(text)` を SECURITY
--     DEFINER で用意する。`auth.users` は通常クライアントから読めないため、関数を経由する。
--     Service Role 専用にするため EXECUTE 権限は service_role のみに付与する。

alter table public.gritvib_chat_members
  add column if not exists stripe_customer_id text;

-- 1 Customer ID = 1 会員。NULL は対象外。
create unique index if not exists gritvib_chat_members_stripe_customer_id_uniq
  on public.gritvib_chat_members (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.gritvib_chat_members.stripe_customer_id is
  'Stripe Customer ID。初回 checkout.session.completed で email から auth.users を解決し、'
  '当該 user の chat_members レコードに保存する。以降の Subscription/Invoice Webhook は'
  'ここで逆引きする。';

-- email → user_id 解決用 RPC (Service Role 専用)。
-- email は `auth.users` で大文字小文字を区別しないため、lower() で比較する。
create or replace function public.gritvib_resolve_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(p_email)
   order by u.created_at asc
   limit 1;
$$;

revoke execute on function public.gritvib_resolve_user_id_by_email(text) from public;
revoke execute on function public.gritvib_resolve_user_id_by_email(text) from authenticated;
revoke execute on function public.gritvib_resolve_user_id_by_email(text) from anon;
grant execute on function public.gritvib_resolve_user_id_by_email(text) to service_role;

comment on function public.gritvib_resolve_user_id_by_email(text) is
  'Stripe Webhook の checkout.session.completed で email -> auth.users.id を解決するための関数。'
  'Service Role のみが実行可能。';
