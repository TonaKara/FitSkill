-- 決済完了後の申込枠確保を skills 行ロック + 進行中取引件数で原子的に行う。
-- 満枠時は更新せず skill_full を返す（Webhook 側で Stripe 返金）。

create or replace function public.claim_skill_application_after_payment(
  p_skill_id bigint,
  p_buyer_id uuid,
  p_seller_id uuid,
  p_stripe_payment_intent_id text default null,
  p_target_transaction_id uuid default null
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
  v_existing record;
  v_tx_id uuid;
  v_tx_status text;
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
    select t.id, t.status, t.buyer_id, t.seller_id, t.skill_id
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

      if v_existing.status = 'awaiting_payment' then
        select count(*)
          into v_active_count
        from public.transactions t
        where t.skill_id = p_skill_id
          and t.status = any (v_slot_statuses);

        if v_active_count >= v_skill.max_capacity then
          raise exception 'skill_full' using errcode = 'SKF01';
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

  select t.id, t.status
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
    if v_existing.status = 'awaiting_payment' then
      select count(*)
        into v_active_count
      from public.transactions t
      where t.skill_id = p_skill_id
        and t.status = any (v_slot_statuses);

      if v_active_count >= v_skill.max_capacity then
        raise exception 'skill_full' using errcode = 'SKF01';
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

  select count(*)
    into v_active_count
  from public.transactions t
  where t.skill_id = p_skill_id
    and t.status = any (v_slot_statuses);

  if v_active_count >= v_skill.max_capacity then
    raise exception 'skill_full' using errcode = 'SKF01';
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

revoke all on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid
) from public;

grant execute on function public.claim_skill_application_after_payment(
  bigint,
  uuid,
  uuid,
  text,
  uuid
) to service_role;
