-- 公開スキルの「現在の申し込み人数」だけを安全に返す RPC。
-- 取引行そのものを広く読めるポリシーは削除する。

drop policy if exists "transactions_select_public_count_on_published_skill" on public.transactions;

create or replace function public.count_active_transactions_for_skill(p_skill_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  select count(*)
    into v_count
  from public.transactions t
  join public.skills s
    on s.id = t.skill_id
  where t.skill_id = p_skill_id
    and t.status <> 'completed'
    and (
      coalesce(s.is_published, true) = true
      or s.user_id = auth.uid()
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.count_active_transactions_for_skill(bigint) from public;
grant execute on function public.count_active_transactions_for_skill(bigint) to anon;
grant execute on function public.count_active_transactions_for_skill(bigint) to authenticated;
