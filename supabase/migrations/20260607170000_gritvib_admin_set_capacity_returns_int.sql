-- void 戻り値の RPC は PostgREST / JS クライアントで保存失敗になることがあるため integer を返す。
-- 戻り値型の変更は CREATE OR REPLACE 不可のため、一度 DROP する。

drop function if exists public.gritvib_admin_set_subscription_capacity_max(integer);

create function public.gritvib_admin_set_subscription_capacity_max(
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
