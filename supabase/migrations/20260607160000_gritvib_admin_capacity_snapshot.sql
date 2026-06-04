-- 管理画面の枠表示・保存後確認用（JSON 1 件・admin チェック込み）。

insert into public.gritvib_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.gritvib_get_subscription_capacity_status()
returns table (
  active_count bigint,
  capacity_max integer,
  accepting_new boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.gritvib_count_active_subscriptions() as active_count,
    s.subscription_capacity_max as capacity_max,
    (
      s.subscription_capacity_max is null
      or public.gritvib_count_active_subscriptions() < s.subscription_capacity_max
    ) as accepting_new
  from (select 1) as _singleton
  left join public.gritvib_settings s on s.id = 1;
$$;

create or replace function public.gritvib_admin_subscription_capacity_snapshot()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_active bigint;
begin
  if not public.gritvib_is_gritvib_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select s.subscription_capacity_max
    into v_max
    from public.gritvib_settings s
   where s.id = 1;

  v_active := public.gritvib_count_active_subscriptions();

  return json_build_object(
    'active_count', v_active,
    'capacity_max', v_max,
    'accepting_new', (v_max is null or v_active < v_max)
  );
end;
$$;

revoke all on function public.gritvib_get_subscription_capacity_status() from public;
grant execute on function public.gritvib_get_subscription_capacity_status() to authenticated;
grant execute on function public.gritvib_get_subscription_capacity_status() to service_role;

revoke all on function public.gritvib_admin_subscription_capacity_snapshot() from public;
revoke all on function public.gritvib_admin_subscription_capacity_snapshot() from anon;
grant execute on function public.gritvib_admin_subscription_capacity_snapshot() to authenticated;
grant execute on function public.gritvib_admin_subscription_capacity_snapshot() to service_role;

comment on function public.gritvib_admin_subscription_capacity_snapshot() is
  'GritVib 管理画面: 有効人数・上限・受付可否を JSON で返す。admin のみ。';
