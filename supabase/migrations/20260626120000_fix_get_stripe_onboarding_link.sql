-- get_stripe_onboarding_link を profiles 実在カラム前提で再定義
-- 利用カラム:
--   public.profiles.id (uuid)
--   public.profiles.is_stripe_registered (boolean)
--   public.profiles.stripe_connect_account_id (text)
--   public.profiles.stripe_connect_charges_enabled (boolean)

create or replace function public.get_stripe_onboarding_link()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_registered boolean;
  v_account_id text;
  v_charges_enabled boolean;
  v_url text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select
    p.is_stripe_registered,
    p.stripe_connect_account_id,
    p.stripe_connect_charges_enabled
  into
    v_is_registered,
    v_account_id,
    v_charges_enabled
  from public.profiles as p
  where p.id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  -- 返却は常に { url: string } 形式に統一する。
  -- 登録済みかつアカウントID保持時はダッシュボード導線、未登録時は登録導線を返す。
  if coalesce(v_is_registered, false) = true
     and coalesce(nullif(v_account_id, ''), '') <> ''
     and coalesce(v_charges_enabled, false) = true then
    v_url := 'https://dashboard.stripe.com/express';
  else
    v_url := 'https://connect.stripe.com/express/oauth/authorize';
  end if;

  return jsonb_build_object('url', v_url);
end;
$$;

grant execute on function public.get_stripe_onboarding_link() to authenticated;
