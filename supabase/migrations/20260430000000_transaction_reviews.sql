-- ratings (評価)
-- id UUID / transaction_id BIGINT / sender_id UUID / receiver_id UUID / rating INTEGER(1-5) / comment TEXT

alter table public.profiles add column if not exists rating_avg numeric;
alter table public.profiles add column if not exists review_count integer not null default 0;

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  transaction_id bigint not null,
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint ratings_rating_check check (rating between 1 and 5),
  constraint ratings_different_parties check (sender_id <> receiver_id),
  constraint ratings_one_per_sender unique (transaction_id, sender_id)
);

create index if not exists ratings_transaction_id_idx
  on public.ratings (transaction_id);
create index if not exists ratings_receiver_id_idx
  on public.ratings (receiver_id);

alter table public.ratings enable row level security;

drop policy if exists "ratings_select_parties" on public.ratings;
create policy "ratings_select_parties"
  on public.ratings for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = ratings.transaction_id
        and (auth.uid() = t.buyer_id or auth.uid() = t.seller_id)
    )
  );

drop policy if exists "ratings_insert_by_sender" on public.ratings;
create policy "ratings_insert_by_sender"
  on public.ratings for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
        and t.status in ('completed', 'canceled', 'refunded')
        and (t.buyer_id = receiver_id or t.seller_id = receiver_id)
        and receiver_id <> auth.uid()
    )
  );

-- 被評価者の集計（profiles.rating_avg / review_count）
create or replace function public.refresh_profile_review_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_cnt integer;
begin
  select
    coalesce(avg(rating::numeric), 0),
    count(*)::integer
  into v_avg, v_cnt
  from public.ratings
  where receiver_id = p_user_id;

  if v_cnt = 0 then
    update public.profiles
    set rating_avg = null, review_count = 0
    where id = p_user_id;
  else
    update public.profiles
    set
      rating_avg = round(v_avg, 2),
      review_count = v_cnt
    where id = p_user_id;
  end if;
end;
$$;

create or replace function public.on_transaction_review_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_review_stats(new.receiver_id);
  return new;
end;
$$;

drop trigger if exists tr_ratings_after_insert on public.ratings;
create trigger tr_ratings_after_insert
  after insert on public.ratings
  for each row
  execute procedure public.on_transaction_review_after_insert();
