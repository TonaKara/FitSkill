-- 管理画面から上限人数を確実に保存（RLS の update 0 件問題を回避）。

create or replace function public.gritvib_admin_set_subscription_capacity_max(
  p_capacity_max integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gritvib_is_gritvib_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_capacity_max is not null and p_capacity_max < 0 then
    raise exception 'invalid_capacity' using errcode = '22023';
  end if;

  insert into public.gritvib_settings (id, subscription_capacity_max, updated_at)
  values (1, p_capacity_max, now())
  on conflict (id) do update
  set
    subscription_capacity_max = excluded.subscription_capacity_max,
    updated_at = excluded.updated_at;

  return p_capacity_max;
end;
$$;

revoke all on function public.gritvib_admin_set_subscription_capacity_max(integer) from public;
revoke all on function public.gritvib_admin_set_subscription_capacity_max(integer) from anon;
grant execute on function public.gritvib_admin_set_subscription_capacity_max(integer) to authenticated;
grant execute on function public.gritvib_admin_set_subscription_capacity_max(integer) to service_role;

comment on function public.gritvib_admin_set_subscription_capacity_max(integer) is
  'GritVib 管理画面: サブスク新規枠の上限人数を保存。NULL は無制限。admin のみ。';
