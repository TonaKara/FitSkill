-- gritvib_admin_get_member_emails が失敗する問題の修正。
--
-- 原因候補:
--   - gritvib_is_gritvib_admin() のネスト呼び出しと権限まわり
--   - profiles.is_admin が NULL のとき exists (... is_admin = true) が false になる
--
-- 対応:
--   - 管理者判定を RPC 内でインライン化 (coalesce 付き)
--   - gritvib_is_gritvib_admin も coalesce で統一
--   - EXECUTE 権限を authenticated / service_role に再付与

create or replace function public.gritvib_is_gritvib_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  );
$$;

revoke all on function public.gritvib_is_gritvib_admin() from public;
grant execute on function public.gritvib_is_gritvib_admin() to authenticated;
grant execute on function public.gritvib_is_gritvib_admin() to service_role;

create or replace function public.gritvib_admin_get_member_emails(p_member_id uuid default null)
returns table(member_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  ) then
    raise exception 'forbidden'
      using errcode = '42501';
  end if;

  return query
    select m.id, u.email
      from public.gritvib_chat_members m
      left join auth.users u on u.id = m.id
     where p_member_id is null or m.id = p_member_id;
end;
$$;

revoke all on function public.gritvib_admin_get_member_emails(uuid) from public;
grant execute on function public.gritvib_admin_get_member_emails(uuid) to authenticated;
grant execute on function public.gritvib_admin_get_member_emails(uuid) to service_role;

