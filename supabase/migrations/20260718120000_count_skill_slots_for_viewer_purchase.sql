-- 購入者が自分の Checkout 仮押さえを持っている場合、グローバル枠数から 1 を差し引いた値を返す。
-- UI の「満枠対応中」が、本人の決済準備中だけで満枠表示になるのを防ぐ（count_active_transactions_for_skill は仮押さえを全員分集計するため）。

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
  )
    into v_has_own_active_r;

  if coalesce(v_has_own_active_r, false) then
    return greatest(0, coalesce(v_global, 0) - 1);
  end if;

  return coalesce(v_global, 0);
end;
$$;

revoke all on function public.count_skill_slots_for_viewer_purchase(bigint) from public;
grant execute on function public.count_skill_slots_for_viewer_purchase(bigint) to anon;
grant execute on function public.count_skill_slots_for_viewer_purchase(bigint) to authenticated;
