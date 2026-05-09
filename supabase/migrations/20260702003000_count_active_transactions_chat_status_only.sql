-- 申し込み人数は「実際に取引チャットとして進行中の transactions 件数」で判定する。
-- completed 以外を広く数えると awaiting_payment / canceled / refunded が混入して満枠誤判定になるため、
-- チャット導線で使う進行中ステータスのみに限定する。

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
    and t.status in ('pending', 'in_progress', 'active', 'approval_pending', 'disputed')
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
