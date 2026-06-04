-- 会員本人が gritvib_chat_members を SELECT すると stripe_customer_id 等が丸見えになるため、
-- 本人向けの行参照ポリシーを廃止し、必要列だけを返す SECURITY DEFINER 関数に限定する。

drop policy if exists gritvib_chat_members_select_self on public.gritvib_chat_members;

create or replace function public.gritvib_chat_self_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gritvib_chat_members m
    where m.id = auth.uid()
  );
$$;

revoke all on function public.gritvib_chat_self_is_member() from public;
grant execute on function public.gritvib_chat_self_is_member() to authenticated;

comment on function public.gritvib_chat_self_is_member() is
  '認証ユーザー本人が gritvib_chat_members にレコードを持つか。stripe_customer_id 等は返さない。';

create or replace function public.gritvib_chat_self_member_profile()
returns table(id uuid, nickname text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.nickname
  from public.gritvib_chat_members m
  where m.id = auth.uid();
$$;

revoke all on function public.gritvib_chat_self_member_profile() from public;
grant execute on function public.gritvib_chat_self_member_profile() to authenticated;

comment on function public.gritvib_chat_self_member_profile() is
  '本人の会員 id / ニックネームのみ。課金・Stripe 連携列は含めない。';
