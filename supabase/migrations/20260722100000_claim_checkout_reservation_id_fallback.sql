-- claim_skill_application_after_payment に Stripe metadata の checkout_reservation_id を渡せるようにする。
-- セッション ID だけでは予約行にヒットしないケース（attach 失敗・列未反映など）でも同一予約をロックし、
-- stripe_checkout_session_id が NULL ならこの RPC 内で補完してから既存ロジックへ進む。
-- 旧シグネチャの関数が残ると RPC が曖昧になるため明示 DROP する。

drop function if exists public.claim_skill_application_after_payment(bigint, uuid, uuid, text, uuid, text);

create or replace function public.claim_skill_application_after_payment(
  p_skill_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_stripe_payment_intent_id text default null,
  p_target_transaction_id uuid default null,
  p_stripe_checkout_session_id text default null,
  p_checkout_reservation_id uuid default null
)
returns table (
  transaction_id uuid,
  status text,
  already_existed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill record;
  v_active_count bigint;
  v_reservation_count bigint;
  v_existing record;
  v_reservation record;
  v_tx_id uuid;
  v_tx_status text;
  v_has_reservation boolean := false;
  v_reservation_pk uuid;
  v_res_lock_acquired boolean := false;
  v_slot_statuses text[] := array['pending', 'in_progress', 'active', 'approval_pending', 'disputed'];
begin
  if p_buyer_id = p_seller_id then
    raise exception 'buyer and seller cannot be the same' using errcode = 'P0001';
  end if;

  select s.id, s.max_capacity, s.user_id, s.price
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

  v_reservation_pk := null;

  if nullif(trim(p_stripe_checkout_session_id), '') is not null then
    select r.id, r.skill_id, r.buyer_id, r.seller_id, r.expires_at, r.consumed_at, r.released_at
      into v_reservation
    from public.skill_checkout_reservations r
    where r.stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
    for update;

    if found then
      v_res_lock_acquired := true;
    elsif p_checkout_reservation_id is not null then
      select r.id, r.skill_id, r.buyer_id, r.seller_id, r.expires_at, r.consumed_at, r.released_at
        into v_reservation
      from public.skill_checkout_reservations r
      where r.id = p_checkout_reservation_id
      for update;

      if found then
        v_res_lock_acquired := true;
        if v_reservation.skill_id <> p_skill_id
          or v_reservation.buyer_id <> p_buyer_id
          or v_reservation.seller_id <> p_seller_id then
          raise exception 'metadata mismatch' using errcode = 'P0001';
        end if;

        if nullif(trim(v_reservation.stripe_checkout_session_id), '') is null then
          update public.skill_checkout_reservations r2
             set stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
           where r2.id = v_reservation.id
             and nullif(trim(r2.stripe_checkout_session_id), '') is null;
        elsif trim(v_reservation.stripe_checkout_session_id) <> trim(p_stripe_checkout_session_id) then
          raise exception 'metadata mismatch' using errcode = 'P0001';
        end if;
      end if;
    end if;

    if v_res_lock_acquired then
      if v_reservation.skill_id <> p_skill_id
        or v_reservation.buyer_id <> p_buyer_id
        or v_reservation.seller_id <> p_seller_id then
        raise exception 'metadata mismatch' using errcode = 'P0001';
      end if;

      if v_reservation.released_at is null
        and v_reservation.consumed_at is null then
        v_reservation_pk := v_reservation.id;
        v_has_reservation := true;
      end if;
    end if;
  end if;

  if p_stripe_payment_intent_id is not null and nullif(trim(p_stripe_payment_intent_id), '') is not null then
    select t.id, t.status
      into v_existing
    from public.transactions t
    where t.stripe_payment_intent_id = trim(p_stripe_payment_intent_id)
    order by t.created_at desc
    limit 1;

    if found then
      if v_reservation_pk is not null then
        update public.skill_checkout_reservations r
           set consumed_at = now()
         where r.id = v_reservation_pk
           and r.consumed_at is null
           and r.released_at is null;
      end if;
      return query
      select v_existing.id, v_existing.status::text, true;
      return;
    end if;
  end if;

  if p_target_transaction_id is not null then
    select t.id, t.status, t.buyer_id, t.seller_id, t.skill_id, t.stripe_payment_intent_id
      into v_existing
    from public.transactions t
    where t.id = p_target_transaction_id
    for update;

    if found then
      if v_existing.buyer_id <> p_buyer_id
        or v_existing.seller_id <> p_seller_id
        or v_existing.skill_id <> p_skill_id then
        raise exception 'metadata mismatch' using errcode = 'P0001';
      end if;

      if p_stripe_payment_intent_id is not null
        and v_existing.stripe_payment_intent_id is not null
        and v_existing.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id) then
        raise exception 'duplicate_payment' using errcode = 'SKD01';
      end if;

      if v_existing.status = 'awaiting_payment' then
        if not v_has_reservation then
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
        end if;

        update public.transactions t
           set status = 'active',
               stripe_payment_intent_id = coalesce(nullif(trim(p_stripe_payment_intent_id), ''), t.stripe_payment_intent_id),
               completed_at = null,
               auto_complete_at = null
         where t.id = v_existing.id
           and t.status = 'awaiting_payment'
         returning t.id, t.status into v_tx_id, v_tx_status;

        if not found then
          select t.id, t.status
            into v_tx_id, v_tx_status
          from public.transactions t
          where t.id = v_existing.id;
        end if;

        if v_reservation_pk is not null then
          update public.skill_checkout_reservations r
             set consumed_at = now()
           where r.id = v_reservation_pk
             and r.consumed_at is null
             and r.released_at is null;
        end if;
        return query
        select v_tx_id, v_tx_status::text, false;
        return;
      end if;

      if v_reservation_pk is not null then
        update public.skill_checkout_reservations r
           set consumed_at = now()
         where r.id = v_reservation_pk
           and r.consumed_at is null
           and r.released_at is null;
      end if;
      return query
      select v_existing.id, v_existing.status::text, true;
      return;
    end if;
  end if;

  select t.id, t.status, t.stripe_payment_intent_id
    into v_existing
  from public.transactions t
  where t.skill_id = p_skill_id
    and t.buyer_id = p_buyer_id
    and (
      t.status = 'awaiting_payment'
      or t.status = any (v_slot_statuses)
    )
  order by t.created_at desc
  limit 1
  for update;

  if found then
    if p_stripe_payment_intent_id is not null
      and v_existing.stripe_payment_intent_id is not null
      and v_existing.stripe_payment_intent_id <> trim(p_stripe_payment_intent_id) then
      raise exception 'duplicate_payment' using errcode = 'SKD01';
    end if;

    if v_existing.status = 'awaiting_payment' then
      if not v_has_reservation then
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
      end if;

      update public.transactions t
         set status = 'active',
             stripe_payment_intent_id = coalesce(nullif(trim(p_stripe_payment_intent_id), ''), t.stripe_payment_intent_id),
             completed_at = null,
             auto_complete_at = null
       where t.id = v_existing.id
         and t.status = 'awaiting_payment'
       returning t.id, t.status into v_tx_id, v_tx_status;

      if not found then
        select t.id, t.status
          into v_tx_id, v_tx_status
        from public.transactions t
        where t.id = v_existing.id;
      end if;

      if v_reservation_pk is not null then
        update public.skill_checkout_reservations r
           set consumed_at = now()
         where r.id = v_reservation_pk
           and r.consumed_at is null
           and r.released_at is null;
      end if;
      return query
      select v_tx_id, v_tx_status::text, false;
      return;
    end if;

    if v_reservation_pk is not null then
      update public.skill_checkout_reservations r
         set consumed_at = now()
       where r.id = v_reservation_pk
         and r.consumed_at is null
         and r.released_at is null;
    end if;
    return query
    select v_existing.id, v_existing.status::text, true;
    return;
  end if;

  if not v_has_reservation then
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
  end if;

  begin
    insert into public.transactions (
      skill_id,
      buyer_id,
      seller_id,
      price,
      status,
      stripe_payment_intent_id
    )
    values (
      p_skill_id,
      p_buyer_id,
      p_seller_id,
      greatest(0, round(v_skill.price::numeric)::integer),
      'active',
      nullif(trim(p_stripe_payment_intent_id), '')
    )
    returning id, status into v_tx_id, v_tx_status;

    if v_reservation_pk is not null then
      update public.skill_checkout_reservations r
         set consumed_at = now()
       where r.id = v_reservation_pk
         and r.consumed_at is null
         and r.released_at is null;
    end if;
    return query
    select v_tx_id, v_tx_status::text, false;
    return;
  exception
    when unique_violation then
      select t.id, t.status
        into v_tx_id, v_tx_status
      from public.transactions t
      where t.skill_id = p_skill_id
        and t.buyer_id = p_buyer_id
        and t.seller_id = p_seller_id
        and (
          p_stripe_payment_intent_id is null
          or nullif(trim(p_stripe_payment_intent_id), '') is null
          or t.stripe_payment_intent_id = trim(p_stripe_payment_intent_id)
        )
      order by t.created_at desc
      limit 1;

      if not found then
        raise;
      end if;

      if v_reservation_pk is not null then
        update public.skill_checkout_reservations r
           set consumed_at = now()
         where r.id = v_reservation_pk
           and r.consumed_at is null
           and r.released_at is null;
      end if;

      return query
      select v_tx_id, v_tx_status::text, true;
      return;
  end;
end;
$$;

revoke all on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid
) from public;

grant execute on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid
) to service_role;
