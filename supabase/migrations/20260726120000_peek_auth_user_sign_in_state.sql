-- ログイン画面から「初回パスワードログイン前」判定用（auth.users.last_sign_in_at / email_confirmed_at）
-- service_role のみ実行可。anon/authenticated には付与しない。

create or replace function public.peek_auth_user_sign_in_state(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u_last timestamptz;
  u_confirmed timestamptz;
begin
  if p_email is null or length(trim(p_email)) < 3 then
    return null;
  end if;

  select u.last_sign_in_at, u.email_confirmed_at
    into u_last, u_confirmed
  from auth.users as u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'last_sign_in_at', u_last,
    'email_confirmed_at', u_confirmed
  );
end;
$$;

revoke all on function public.peek_auth_user_sign_in_state(text) from public;
grant execute on function public.peek_auth_user_sign_in_state(text) to service_role;

comment on function public.peek_auth_user_sign_in_state(text) is
  'メール確認済みかつ last_sign_in_at が無いユーザーの初回ログイン誘導用。service_role のみ。';
