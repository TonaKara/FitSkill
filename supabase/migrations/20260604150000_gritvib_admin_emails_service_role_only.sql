-- gritvib_admin_get_member_emails を service_role 専用に変更。
--
-- 理由:
--   - auth.users 参照は gritvib_resolve_user_id_by_email と同様、サーバー側のみに限定する。
--   - Server Action から user session で RPC すると auth.uid() が NULL になり forbidden になることがある。
--   - 管理画面では requireGritvibAdminUser() 済みのうえ supabaseAdmin (service role) で呼ぶ。

create or replace function public.gritvib_admin_get_member_emails(p_member_id uuid default null)
returns table(member_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  return query
    select m.id, u.email::text
      from public.gritvib_chat_members m
      left join auth.users u on u.id = m.id
     where p_member_id is null or m.id = p_member_id;
end;
$$;

revoke all on function public.gritvib_admin_get_member_emails(uuid) from public;
revoke all on function public.gritvib_admin_get_member_emails(uuid) from anon;
revoke all on function public.gritvib_admin_get_member_emails(uuid) from authenticated;
grant execute on function public.gritvib_admin_get_member_emails(uuid) to service_role;

comment on function public.gritvib_admin_get_member_emails(uuid) is
  'GritVib 管理画面用。会員の auth.users.email を返す。service_role のみ実行可（Server Action で admin 確認後に呼ぶ）。';

