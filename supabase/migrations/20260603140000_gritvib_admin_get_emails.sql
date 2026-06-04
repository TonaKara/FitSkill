-- GritVib 管理画面で各会員のメールアドレスを取得するための関数。
--
-- 設計:
--   - admin (`profiles.is_admin = true`) だけが実行可能。関数内部で権限チェックする。
--   - `auth.users.email` は通常 RLS で見えないため SECURITY DEFINER で `auth` schema にアクセスする。
--   - 個別スレッド (`p_member_id` 指定) と一覧 (`p_member_id IS NULL` = 全件) の両用途で使えるよう、
--     入力で絞り込みできる API にしている。

create or replace function public.gritvib_admin_get_member_emails(p_member_id uuid default null)
returns table(member_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'forbidden';
  end if;

  return query
    select m.id, u.email
      from public.gritvib_chat_members m
      left join auth.users u on u.id = m.id
     where p_member_id is null or m.id = p_member_id;
end;
$$;

grant execute on function public.gritvib_admin_get_member_emails(uuid) to authenticated;

comment on function public.gritvib_admin_get_member_emails(uuid) is
  'GritVib 管理画面で各会員のメールアドレスを取得するための関数。admin (profiles.is_admin=true) のみ実行可能。';
