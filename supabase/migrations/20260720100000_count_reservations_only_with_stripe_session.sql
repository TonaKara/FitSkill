-- 申し込み人数（枠表示）: skill_checkout_reservations は
-- stripe_checkout_session_id が付いたあと（Stripe Checkout 遷移後）のみ集計に含める。
-- 「購入する」直後〜セッション作成・attach 前の行は人数に換算しない。
-- cancel / release / TTL 切れ / 返金後は従来どおり released または expires で集計外。

create or replace function public.count_active_skill_checkout_reservations(p_skill_id bigint)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.skill_checkout_reservations r
  where r.skill_id = p_skill_id
    and r.consumed_at is null
    and r.released_at is null
    and r.expires_at > now()
    and nullif(trim(r.stripe_checkout_session_id), '') is not null;
$$;

create or replace function public.count_skill_slots_for_viewer_purchase(p_skill_id bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global bigint;
  v_buyer uuid;
  v_has_own_active_r boolean;
begin
  select public.count_active_transactions_for_skill(p_skill_id) into v_global;

  v_buyer := auth.uid();
  if v_buyer is null then
    return coalesce(v_global, 0);
  end if;

  select exists (
    select 1
    from public.skill_checkout_reservations r
    where r.skill_id = p_skill_id
      and r.buyer_id = v_buyer
      and r.consumed_at is null
      and r.released_at is null
      and r.expires_at > now()
      and nullif(trim(r.stripe_checkout_session_id), '') is not null
  )
    into v_has_own_active_r;

  if coalesce(v_has_own_active_r, false) then
    return greatest(0, coalesce(v_global, 0) - 1);
  end if;

  return coalesce(v_global, 0);
end;
$$;
