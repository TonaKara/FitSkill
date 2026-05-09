-- 管理画面: 「通報が多いユーザー」一覧用の集計ビュー
-- Stripe等の既存処理には影響を与えず、user_reports から被通報ユーザー単位で集計する

drop view if exists public.admin_reported_users_summary;

create view public.admin_reported_users_summary
with (security_invoker = true) as
select
  ur.reported_user_id as id,
  ur.reported_user_id,
  coalesce(p.display_name, '') as display_name,
  coalesce(p.status, 'active') as status,
  count(*)::bigint as report_count,
  max(ur.created_at) as last_reported_at
from public.user_reports ur
left join public.profiles p
  on p.id = ur.reported_user_id
group by ur.reported_user_id, p.display_name, p.status;

grant select on public.admin_reported_users_summary to authenticated;
