-- Stripe Connect 連携列は通常の profiles UPDATE では変更不可なことがあるため、
-- 本人またはサービスロール経由の SECURITY DEFINER RPC で更新する。

create or replace function public.set_profile_stripe_connect_account_id(
  p_account_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.profiles
  set stripe_connect_account_id = nullif(trim(p_account_id), '')
  where id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.set_profile_stripe_connect_status(
  p_charges_enabled boolean,
  p_details_submitted boolean,
  p_is_stripe_registered boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  update public.profiles as p
  set
    stripe_connect_charges_enabled = p_charges_enabled,
    stripe_connect_details_submitted = p_details_submitted,
    is_stripe_registered = case
      when p_is_stripe_registered is null then p.is_stripe_registered
      else p_is_stripe_registered
    end
  where p.id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.set_profile_stripe_connect_account_id(text) from public;
grant execute on function public.set_profile_stripe_connect_account_id(text) to authenticated;
grant execute on function public.set_profile_stripe_connect_account_id(text) to service_role;

revoke all on function public.set_profile_stripe_connect_status(boolean, boolean, boolean) from public;
grant execute on function public.set_profile_stripe_connect_status(boolean, boolean, boolean) to authenticated;
grant execute on function public.set_profile_stripe_connect_status(boolean, boolean, boolean) to service_role;
