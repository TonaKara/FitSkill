-- GritVib 会員のサブスクリプション状態を chat_members に持たせる。
--
-- 設計:
--   - サブスク決済は別フェーズ (Stripe Checkout + Webhook) で接続するが、UI 側で送信制御を
--     先に実装したいので、フラグだけ先行で用意しておく。
--   - 状態は Stripe の `subscriptions.status` をそのままミラーする想定の text 列で持つ。
--     初期値は 'inactive'。
--   - 終了予定時刻 (current_period_end) を持ち、`active` でも期限切れなら送信不可とする判定を可能に。

alter table public.gritvib_chat_members
  add column if not exists subscription_status text not null default 'inactive';

alter table public.gritvib_chat_members
  add column if not exists subscription_current_period_end timestamptz;

comment on column public.gritvib_chat_members.subscription_status is
  'GritVib のサブスクリプション状態。Stripe subscription.status をミラーする想定。初期値 inactive。';
comment on column public.gritvib_chat_members.subscription_current_period_end is
  'GritVib サブスクリプションの現周期終了時刻。past_due 判定や期限切れ後の送信制御で参照する。';

-- 送信可否を判定する読み取り専用関数。
--   - status が 'active' / 'trialing' のいずれか
--   - かつ current_period_end が未来 (または NULL = trial 初期等)
-- の場合に true。
create or replace function public.gritvib_chat_member_can_send(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gritvib_chat_members m
    where m.id = p_member_id
      and m.subscription_status in ('active', 'trialing')
      and (m.subscription_current_period_end is null or m.subscription_current_period_end > now())
  );
$$;

grant execute on function public.gritvib_chat_member_can_send(uuid) to authenticated;

comment on function public.gritvib_chat_member_can_send(uuid) is
  'GritVib の会員が現在メッセージを送信できるかを判定する。subscription_status / current_period_end の両方を見る。';
