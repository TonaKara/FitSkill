-- 既存 ratings データをもとに profiles.rating_avg / review_count を再計算

update public.profiles p
set
  rating_avg = agg.rating_avg,
  review_count = agg.review_count
from (
  select
    r.receiver_id as profile_id,
    round(avg(r.rating::numeric), 2) as rating_avg,
    count(*)::integer as review_count
  from public.ratings r
  group by r.receiver_id
) as agg
where p.id = agg.profile_id;

update public.profiles p
set
  rating_avg = null,
  review_count = 0
where not exists (
  select 1
  from public.ratings r
  where r.receiver_id = p.id
);
