-- gritvib_settings 行が無い環境でも RPC が 1 行返すよう修正。service_role にも execute を付与。

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

revoke all on function public.gritvib_get_subscription_capacity_status() from public;
grant execute on function public.gritvib_get_subscription_capacity_status() to authenticated;
grant execute on function public.gritvib_get_subscription_capacity_status() to service_role;

revoke all on function public.gritvib_count_active_subscriptions() from public;
grant execute on function public.gritvib_count_active_subscriptions() to authenticated;
grant execute on function public.gritvib_count_active_subscriptions() to service_role;
