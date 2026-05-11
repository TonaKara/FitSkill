-- Checkout 開始時の仮押さえと、決済後確定・枠数表示の整合。

create table if not exists public.skill_checkout_reservations (
  id uuid primary key default gen_random_uuid(),
  skill_id bigint not null references public.skills (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  stripe_checkout_session_id text,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  constraint skill_checkout_reservations_buyer_not_seller check (buyer_id <> seller_id)
);

create unique index if not exists skill_checkout_reservations_active_buyer_skill_uidx
  on public.skill_checkout_reservations (skill_id, buyer_id)
  where consumed_at is null
    and released_at is null;

create unique index if not exists skill_checkout_reservations_session_uidx
  on public.skill_checkout_reservations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists skill_checkout_reservations_skill_active_idx
  on public.skill_checkout_reservations (skill_id, expires_at)
  where consumed_at is null
    and released_at is null;

alter table public.skill_checkout_reservations enable row level security;

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
    and r.expires_at > now();
$$;

create or replace function public.count_active_transactions_for_skill(p_skill_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_count bigint;
  v_reservation_count bigint;
begin
  select count(*)
    into v_transaction_count
  from public.transactions t
  join public.skills s
    on s.id = t.skill_id
  where t.skill_id = p_skill_id
    and t.status in ('pending', 'in_progress', 'active', 'approval_pending', 'disputed')
    and (
      coalesce(s.is_published, true) = true
      or s.user_id = auth.uid()
    );

  select public.count_active_skill_checkout_reservations(p_skill_id)
    into v_reservation_count;

  return coalesce(v_transaction_count, 0) + coalesce(v_reservation_count, 0);
end;
$$;

revoke all on function public.count_active_transactions_for_skill(bigint) from public;
grant execute on function public.count_active_transactions_for_skill(bigint) to anon;
grant execute on function public.count_active_transactions_for_skill(bigint) to authenticated;

revoke all on function public.count_active_skill_checkout_reservations(bigint) from public;

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
       set expires_at = now() + make_interval(mins => v_ttl_minutes),
           seller_id = p_seller_id
     where r.id = v_existing_reservation_id
     returning r.id into v_reservation_id;

    return v_reservation_id;
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
end;
$$;

create or replace function public.attach_skill_checkout_reservation_session(
  p_reservation_id uuid,
  p_stripe_checkout_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
begin
  v_session_id := nullif(trim(p_stripe_checkout_session_id), '');
  if v_session_id is null then
    raise exception 'checkout session id is required' using errcode = 'P0001';
  end if;

  update public.skill_checkout_reservations r
     set stripe_checkout_session_id = v_session_id
   where r.id = p_reservation_id
     and r.consumed_at is null
     and r.released_at is null;

  if not found then
    raise exception 'reservation not found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.release_skill_checkout_reservation(
  p_stripe_checkout_session_id text default null,
  p_reservation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reservation_id is not null then
    update public.skill_checkout_reservations r
       set released_at = coalesce(r.released_at, now())
     where r.id = p_reservation_id
       and r.consumed_at is null;
    return;
  end if;

  if nullif(trim(p_stripe_checkout_session_id), '') is null then
    return;
  end if;

  update public.skill_checkout_reservations r
     set released_at = coalesce(r.released_at, now())
   where r.stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
     and r.consumed_at is null;
end;
$$;

create or replace function public.claim_skill_application_after_payment(
  p_skill_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_stripe_payment_intent_id text default null,
  p_target_transaction_id uuid default null,
  p_stripe_checkout_session_id text default null
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

  if nullif(trim(p_stripe_checkout_session_id), '') is not null then
    select r.id, r.skill_id, r.buyer_id, r.seller_id, r.expires_at, r.consumed_at, r.released_at
      into v_reservation
    from public.skill_checkout_reservations r
    where r.stripe_checkout_session_id = trim(p_stripe_checkout_session_id)
    for update;

    if found then
      if v_reservation.skill_id <> p_skill_id
        or v_reservation.buyer_id <> p_buyer_id
        or v_reservation.seller_id <> p_seller_id then
        raise exception 'metadata mismatch' using errcode = 'P0001';
      end if;

      if v_reservation.released_at is null
        and v_reservation.consumed_at is null
        and v_reservation.expires_at > now() then
        update public.skill_checkout_reservations r
           set consumed_at = now()
         where r.id = v_reservation.id
           and r.consumed_at is null
           and r.released_at is null;
        v_has_reservation := true;
      end if;
    end if;
  end if;

  if p_stripe_payment_intent_id is not null then
    select t.id, t.status
      into v_existing
    from public.transactions t
    where t.stripe_payment_intent_id = p_stripe_payment_intent_id
    order by t.created_at desc
    limit 1;

    if found then
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
        and v_existing.stripe_payment_intent_id <> p_stripe_payment_intent_id then
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
               stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, t.stripe_payment_intent_id),
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

        return query
        select v_tx_id, v_tx_status::text, false;
        return;
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
      and v_existing.stripe_payment_intent_id <> p_stripe_payment_intent_id then
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
             stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, t.stripe_payment_intent_id),
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

      return query
      select v_tx_id, v_tx_status::text, false;
      return;
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
    p_stripe_payment_intent_id
  )
  returning id, status into v_tx_id, v_tx_status;

  return query
  select v_tx_id, v_tx_status::text, false;
end;
$$;

revoke all on function public.reserve_skill_checkout_slot(bigint, uuid, uuid, integer) from public;
grant execute on function public.reserve_skill_checkout_slot(bigint, uuid, uuid, integer) to service_role;

revoke all on function public.attach_skill_checkout_reservation_session(uuid, text) from public;
grant execute on function public.attach_skill_checkout_reservation_session(uuid, text) to service_role;

revoke all on function public.release_skill_checkout_reservation(text, uuid) from public;
grant execute on function public.release_skill_checkout_reservation(text, uuid) to service_role;

revoke all on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid,
  text
) from public;

grant execute on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid,
  text
) to service_role;
