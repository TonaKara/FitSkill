-- reserve_skill_checkout_slot: 同一 buyer+skill の未消費・未解放の仮押さえ（TTL 内外問わず）
-- を常に released_at で無効化してから新規 insert する。Checkout を再度開き直す際の
-- 「既存予約の延長で Stripe に遷移しない」系を避ける。
-- （claim 側の冪等化・並行 insert の unique_violation ハンドラは 20260716100000 の定義を維持）

create or replace function public.reserve_skill_checkout_slot(
  p_skill_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_ttl_minutes integer default 35
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill record;
  v_active_count bigint;
  v_reservation_count bigint;
  v_existing_reservation_id uuid;
  v_reservation_id uuid;
  v_ttl_minutes integer;
  v_slot_statuses text[] := array['pending', 'in_progress', 'active', 'approval_pending', 'disputed'];
begin
  if p_buyer_id = p_seller_id then
    raise exception 'buyer and seller cannot be the same' using errcode = 'P0001';
  end if;

  v_ttl_minutes := greatest(5, least(coalesce(p_ttl_minutes, 35), 120));

  select s.id, s.max_capacity, s.user_id
    into v_skill
  from public.skills s
  where s.id = p_skill_id
  for update;

  if not found then
    raise exception 'skill not found' using errcode = 'P0001';
  end if;

  if v_skill.user_id is distinct from p_seller_id then
    raise exception 'seller mismatch' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.transactions t
    where t.skill_id = p_skill_id
      and t.buyer_id = p_buyer_id
      and (
        t.status = 'awaiting_payment'
        or t.status = any (v_slot_statuses)
      )
  ) then
    raise exception 'ongoing_purchase' using errcode = 'SKO01';
  end if;

  select r.id
    into v_existing_reservation_id
  from public.skill_checkout_reservations r
  where r.skill_id = p_skill_id
    and r.buyer_id = p_buyer_id
    and r.consumed_at is null
    and r.released_at is null
  for update;

  if found then
    update public.skill_checkout_reservations r
       set released_at = coalesce(r.released_at, now())
     where r.id = v_existing_reservation_id
       and r.consumed_at is null
       and r.released_at is null;
  end if;

  select count(*)
    into v_active_count
  from public.transactions t
  where t.skill_id = p_skill_id
    and t.status = any (v_slot_statuses);

  select public.count_active_skill_checkout_reservations(p_skill_id)
    into v_reservation_count;

  if v_active_count + v_reservation_count >= v_skill.max_capacity then
    raise exception 'skill_full' using errcode = 'SKF01';
  end if;

  begin
    insert into public.skill_checkout_reservations (
      skill_id,
      buyer_id,
      seller_id,
      expires_at
    )
    values (
      p_skill_id,
      p_buyer_id,
      p_seller_id,
      now() + make_interval(mins => v_ttl_minutes)
    )
    returning id into v_reservation_id;

    return v_reservation_id;
  exception
    when unique_violation then
      select r.id
        into v_reservation_id
      from public.skill_checkout_reservations r
      where r.skill_id = p_skill_id
        and r.buyer_id = p_buyer_id
        and r.consumed_at is null
        and r.released_at is null
      for update;

      if not found then
        raise;
      end if;

      update public.skill_checkout_reservations r
         set expires_at = now() + make_interval(mins => v_ttl_minutes),
             seller_id = p_seller_id
       where r.id = v_reservation_id
       returning r.id into v_reservation_id;

      return v_reservation_id;
  end;
end;
$$;
