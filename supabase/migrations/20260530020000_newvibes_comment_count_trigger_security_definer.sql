-- FromHere の集計用トリガが「他人のプロダクト」では RLS に阻まれて反映されない問題のホットフィックス。
--
-- 背景:
-- - `newvibes_comments` / `newvibes_upvotes` への INSERT は RLS で許可される
--   (`auth.uid() = user_id`)。
-- - しかし AFTER INSERT トリガ (`newvibes_comment_count_after_insert` /
--   `newvibes_upvote_count_after_insert`) が `newvibes_products.{comment,upvote}_count`
--   を UPDATE しようとした際、`newvibes_products_update_owner` RLS が
--   `auth.uid() = maker_id` を要求するため、投稿者が maker でない場合は UPDATE が
--   0 行で no-op となり、集計値が増えない（DELETE 側も同様）。
-- - 結果として「コメント / 応援が反映されない」「count が古いまま」という症状になる。
--
-- 対策:
-- - 集計用トリガ関数を `SECURITY DEFINER` で再定義し、所有者権限で実行することで RLS を
--   バイパスする。`set search_path = public, pg_temp` を必ず付与し、関数内部での名前解決を
--   公開スキーマに固定する（DEFINER 関数のベストプラクティス）。
-- - `revoke ... from public` で関数の直接呼び出し権限を絞り、トリガ経由でのみ走るようにする。

create or replace function public.newvibes_comment_count_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.newvibes_products
  set comment_count = comment_count + 1
  where id = new.product_id;
  return new;
end;
$$;

create or replace function public.newvibes_comment_count_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.newvibes_products
  set comment_count = greatest(0, comment_count - 1)
  where id = old.product_id;
  return old;
end;
$$;

create or replace function public.newvibes_upvote_count_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.newvibes_products
  set upvote_count = upvote_count + 1
  where id = new.product_id;
  return new;
end;
$$;

create or replace function public.newvibes_upvote_count_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.newvibes_products
  set upvote_count = greatest(0, upvote_count - 1)
  where id = old.product_id;
  return old;
end;
$$;

revoke all on function public.newvibes_comment_count_after_insert() from public;
revoke all on function public.newvibes_comment_count_after_delete() from public;
revoke all on function public.newvibes_upvote_count_after_insert() from public;
revoke all on function public.newvibes_upvote_count_after_delete() from public;

-- 既存データの comment_count / upvote_count を「実カウント」で再同期しておく（過去ズレ分の救済）
update public.newvibes_products p
set comment_count = coalesce(sub.cnt, 0)
from (
  select product_id, count(*)::int as cnt
  from public.newvibes_comments
  group by product_id
) sub
where sub.product_id = p.id
  and p.comment_count is distinct from sub.cnt;

update public.newvibes_products p
set comment_count = 0
where comment_count <> 0
  and not exists (
    select 1 from public.newvibes_comments c where c.product_id = p.id
  );

update public.newvibes_products p
set upvote_count = coalesce(sub.cnt, 0)
from (
  select product_id, count(*)::int as cnt
  from public.newvibes_upvotes
  group by product_id
) sub
where sub.product_id = p.id
  and p.upvote_count is distinct from sub.cnt;

update public.newvibes_products p
set upvote_count = 0
where upvote_count <> 0
  and not exists (
    select 1 from public.newvibes_upvotes u where u.product_id = p.id
  );

/**
 * API ハンドラから呼び出して comment_count を「実カウント」で再集計するための SECURITY DEFINER RPC。
 *
 * - AFTER INSERT/DELETE トリガは SECURITY DEFINER に直してあるが、保険として API 側からも
 *   `select rpc(newvibes_recount_product_comments, ...)` を呼べるようにしておく。
 * - 引数の `p_product_id` 単体のみ更新するので、コメント投稿/削除ごとの追加コストは小さい。
 * - 認証されたロール (`authenticated`) からのみ実行可能にする。
 */
create or replace function public.newvibes_recount_product_comments(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.newvibes_products
  set comment_count = (
    select count(*)::int from public.newvibes_comments where product_id = p_product_id
  )
  where id = p_product_id;
end;
$$;

revoke all on function public.newvibes_recount_product_comments(uuid) from public;
grant execute on function public.newvibes_recount_product_comments(uuid) to authenticated, service_role;
