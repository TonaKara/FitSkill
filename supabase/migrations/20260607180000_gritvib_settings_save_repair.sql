-- gritvib_settings の保存経路を安定化（service_role 権限 + 新しい保存 RPC 名）。

grant select, insert, update, delete on table public.gritvib_settings to service_role;

insert into public.gritvib_settings (id, subscription_capacity_max)
values (1, 0)
on conflict (id) do nothing;

-- 旧 void 版との衝突を避けるため別名。戻り値は保存した上限。
drop function if exists public.gritvib_admin_save_subscription_capacity_max(integer);

create function public.gritvib_admin_save_subscription_capacity_max(
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

  if p_capacity_max < 0 then
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

revoke all on function public.gritvib_admin_save_subscription_capacity_max(integer) from public;
revoke all on function public.gritvib_admin_save_subscription_capacity_max(integer) from anon;
grant execute on function public.gritvib_admin_save_subscription_capacity_max(integer) to authenticated;
grant execute on function public.gritvib_admin_save_subscription_capacity_max(integer) to service_role;

comment on function public.gritvib_admin_save_subscription_capacity_max(integer) is
  'GritVib 管理画面: サブスク新規枠の上限を保存（admin のみ）。';
