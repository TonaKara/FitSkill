-- =============================================================================
-- FromHere Phase 1: 初期スキーマ（テーブル / RLS / トリガー）
-- =============================================================================
-- /fromhere 機能用の独立したテーブル群。GritVib 本体の public.profiles 等とは
-- 紐付かず、auth.users.id だけを共通の認証基盤として使う。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 共通: updated_at を自動で now() に更新する関数
-- -----------------------------------------------------------------------------
create or replace function public.newvibes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. newvibes_profiles（メーカープロフィール）
-- =============================================================================
-- - id は auth.users.id を直接参照（1:1）
-- - handle は小文字英数 + アンダースコア、3〜20 文字、一意
-- - handle 変更は handle_change_count によって 1 回までに制限（トリガーで強制）
-- =============================================================================
create table if not exists public.newvibes_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 50),
  bio text check (bio is null or char_length(bio) <= 280),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  twitter_url text check (twitter_url is null or twitter_url ~ '^https?://'),
  github_url text check (github_url is null or github_url ~ '^https?://'),
  handle_change_count integer not null default 0,
  handle_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newvibes_profiles_handle_idx on public.newvibes_profiles (handle);

-- 予約済みハンドル（システムで使うため一般ユーザーは取得不可）
create table if not exists public.newvibes_reserved_handles (
  handle text primary key
);
insert into public.newvibes_reserved_handles (handle) values
  ('admin'), ('administrator'), ('root'), ('support'), ('help'),
  ('api'), ('app'), ('www'), ('fromhere'), ('gritvib'),
  ('login'), ('signin'), ('signup'), ('register'), ('logout'),
  ('settings'), ('account'), ('me'), ('you'), ('staff'),
  ('moderator'), ('mod'), ('official'), ('system'), ('null'),
  ('undefined'), ('about'), ('contact'), ('guide'), ('legal'),
  ('terms'), ('privacy'), ('discover'), ('skills'), ('chat'),
  ('inquiry'), ('mypage'), ('profile'), ('store')
on conflict do nothing;

-- 予約語チェック・トリガー
create or replace function public.newvibes_check_handle_not_reserved()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.newvibes_reserved_handles where handle = new.handle
  ) then
    raise exception 'Handle "%" is reserved.', new.handle using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists newvibes_profiles_check_handle_reserved on public.newvibes_profiles;
create trigger newvibes_profiles_check_handle_reserved
  before insert or update of handle on public.newvibes_profiles
  for each row execute function public.newvibes_check_handle_not_reserved();

-- ハンドル変更回数制限（最大 1 回）
create or replace function public.newvibes_check_handle_change_limit()
returns trigger
language plpgsql
as $$
begin
  if old.handle is distinct from new.handle then
    if old.handle_change_count >= 1 then
      raise exception 'Handle change limit reached. Contact support for further changes.'
        using errcode = '23514';
    end if;
    new.handle_change_count = old.handle_change_count + 1;
    new.handle_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists newvibes_profiles_check_handle_change on public.newvibes_profiles;
create trigger newvibes_profiles_check_handle_change
  before update on public.newvibes_profiles
  for each row execute function public.newvibes_check_handle_change_limit();

-- updated_at 自動更新
drop trigger if exists newvibes_profiles_updated_at on public.newvibes_profiles;
create trigger newvibes_profiles_updated_at
  before update on public.newvibes_profiles
  for each row execute function public.newvibes_set_updated_at();

-- RLS
alter table public.newvibes_profiles enable row level security;

drop policy if exists "newvibes_profiles_select_public" on public.newvibes_profiles;
create policy "newvibes_profiles_select_public"
  on public.newvibes_profiles for select
  using (true);

drop policy if exists "newvibes_profiles_insert_self" on public.newvibes_profiles;
create policy "newvibes_profiles_insert_self"
  on public.newvibes_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "newvibes_profiles_update_self" on public.newvibes_profiles;
create policy "newvibes_profiles_update_self"
  on public.newvibes_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =============================================================================
-- 2. newvibes_products（投稿されたプロダクト）
-- =============================================================================
-- - slug はサーバー側でタイトルから自動生成（クライアントから直接指定はしない）
-- - app_icon_path / screenshot_path は Supabase Storage のオブジェクトキーを保持
--   バケットは別マイグレーション（20260528181100_newvibes_storage.sql）で作成
-- - upvote_count / comment_count はトリガーで集計（ソートを高速化するため）
-- =============================================================================
create table if not exists public.newvibes_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (char_length(trim(title)) between 1 and 100),
  tagline text not null check (char_length(trim(tagline)) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  category text not null check (category in (
    'ai', 'dev', 'saas', 'mobile', 'web',
    'productivity', 'design', 'game', 'other'
  )),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 5),
  product_url text not null check (product_url ~ '^https?://'),
  app_icon_path text check (app_icon_path is null or char_length(app_icon_path) <= 500),
  screenshot_path text check (screenshot_path is null or char_length(screenshot_path) <= 500),
  thumbnail_emoji text check (thumbnail_emoji is null or char_length(thumbnail_emoji) <= 8),
  thumbnail_gradient text check (thumbnail_gradient is null or char_length(thumbnail_gradient) <= 80),
  maker_id uuid not null references public.newvibes_profiles (id) on delete cascade,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  upvote_count integer not null default 0,
  comment_count integer not null default 0,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newvibes_products_posted_at_idx on public.newvibes_products (posted_at desc);
create index if not exists newvibes_products_upvote_count_idx on public.newvibes_products (upvote_count desc);
create index if not exists newvibes_products_category_idx on public.newvibes_products (category);
create index if not exists newvibes_products_status_idx on public.newvibes_products (status);
create index if not exists newvibes_products_maker_id_idx on public.newvibes_products (maker_id);
create index if not exists newvibes_products_tags_gin_idx on public.newvibes_products using gin (tags);

-- updated_at 自動更新
drop trigger if exists newvibes_products_updated_at on public.newvibes_products;
create trigger newvibes_products_updated_at
  before update on public.newvibes_products
  for each row execute function public.newvibes_set_updated_at();

-- RLS
alter table public.newvibes_products enable row level security;

drop policy if exists "newvibes_products_select_published_or_owner" on public.newvibes_products;
create policy "newvibes_products_select_published_or_owner"
  on public.newvibes_products for select
  using (status = 'published' or auth.uid() = maker_id);

drop policy if exists "newvibes_products_insert_owner" on public.newvibes_products;
create policy "newvibes_products_insert_owner"
  on public.newvibes_products for insert
  with check (auth.uid() = maker_id);

drop policy if exists "newvibes_products_update_owner" on public.newvibes_products;
create policy "newvibes_products_update_owner"
  on public.newvibes_products for update
  using (auth.uid() = maker_id)
  with check (auth.uid() = maker_id);

drop policy if exists "newvibes_products_delete_owner" on public.newvibes_products;
create policy "newvibes_products_delete_owner"
  on public.newvibes_products for delete
  using (auth.uid() = maker_id);

-- =============================================================================
-- 3. newvibes_upvotes（応援）
-- =============================================================================
-- - (product_id, user_id) UNIQUE で 1 ユーザー 1 プロダクト 1 票を保証
-- - upvote_count はトリガーで自動集計
-- =============================================================================
create table if not exists public.newvibes_upvotes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.newvibes_products (id) on delete cascade,
  user_id uuid not null references public.newvibes_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists newvibes_upvotes_product_idx on public.newvibes_upvotes (product_id);
create index if not exists newvibes_upvotes_user_idx on public.newvibes_upvotes (user_id);

create or replace function public.newvibes_upvote_count_after_insert()
returns trigger
language plpgsql
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
as $$
begin
  update public.newvibes_products
  set upvote_count = greatest(0, upvote_count - 1)
  where id = old.product_id;
  return old;
end;
$$;

drop trigger if exists newvibes_upvotes_insert_count on public.newvibes_upvotes;
create trigger newvibes_upvotes_insert_count
  after insert on public.newvibes_upvotes
  for each row execute function public.newvibes_upvote_count_after_insert();

drop trigger if exists newvibes_upvotes_delete_count on public.newvibes_upvotes;
create trigger newvibes_upvotes_delete_count
  after delete on public.newvibes_upvotes
  for each row execute function public.newvibes_upvote_count_after_delete();

-- RLS
alter table public.newvibes_upvotes enable row level security;

drop policy if exists "newvibes_upvotes_select_public" on public.newvibes_upvotes;
create policy "newvibes_upvotes_select_public"
  on public.newvibes_upvotes for select
  using (true);

drop policy if exists "newvibes_upvotes_insert_self" on public.newvibes_upvotes;
create policy "newvibes_upvotes_insert_self"
  on public.newvibes_upvotes for insert
  with check (auth.uid() = user_id);

drop policy if exists "newvibes_upvotes_delete_self" on public.newvibes_upvotes;
create policy "newvibes_upvotes_delete_self"
  on public.newvibes_upvotes for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- 4. newvibes_comments（コメント）
-- =============================================================================
-- - parent_id でリプライ階層を許可（フェーズ 5 で使う、UI 未対応のうちは null）
-- - body は 1〜2000 文字
-- - comment_count はトリガーで自動集計
-- =============================================================================
create table if not exists public.newvibes_comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.newvibes_products (id) on delete cascade,
  user_id uuid not null references public.newvibes_profiles (id) on delete cascade,
  parent_id uuid references public.newvibes_comments (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newvibes_comments_product_idx
  on public.newvibes_comments (product_id, created_at desc);
create index if not exists newvibes_comments_user_idx on public.newvibes_comments (user_id);
create index if not exists newvibes_comments_parent_idx on public.newvibes_comments (parent_id);

drop trigger if exists newvibes_comments_updated_at on public.newvibes_comments;
create trigger newvibes_comments_updated_at
  before update on public.newvibes_comments
  for each row execute function public.newvibes_set_updated_at();

create or replace function public.newvibes_comment_count_after_insert()
returns trigger
language plpgsql
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
as $$
begin
  update public.newvibes_products
  set comment_count = greatest(0, comment_count - 1)
  where id = old.product_id;
  return old;
end;
$$;

drop trigger if exists newvibes_comments_insert_count on public.newvibes_comments;
create trigger newvibes_comments_insert_count
  after insert on public.newvibes_comments
  for each row execute function public.newvibes_comment_count_after_insert();

drop trigger if exists newvibes_comments_delete_count on public.newvibes_comments;
create trigger newvibes_comments_delete_count
  after delete on public.newvibes_comments
  for each row execute function public.newvibes_comment_count_after_delete();

-- RLS
alter table public.newvibes_comments enable row level security;

drop policy if exists "newvibes_comments_select_public" on public.newvibes_comments;
create policy "newvibes_comments_select_public"
  on public.newvibes_comments for select
  using (true);

drop policy if exists "newvibes_comments_insert_self" on public.newvibes_comments;
create policy "newvibes_comments_insert_self"
  on public.newvibes_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "newvibes_comments_update_self" on public.newvibes_comments;
create policy "newvibes_comments_update_self"
  on public.newvibes_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "newvibes_comments_delete_self" on public.newvibes_comments;
create policy "newvibes_comments_delete_self"
  on public.newvibes_comments for delete
  using (auth.uid() = user_id);
