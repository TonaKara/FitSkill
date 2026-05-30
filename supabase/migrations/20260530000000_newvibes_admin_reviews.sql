-- =============================================================================
-- FromHere: 運営レビュー（管理者がプロジェクトをレビューしてトップで紹介する機能）
-- =============================================================================
-- - 管理者は本体 `public.profiles.is_admin = true` のユーザー。
-- - 公開行は誰でも SELECT 可、書き込みは管理者のみ。
-- - status = 'draft' のレビューは管理者だけが見える（公開予定の下書き）。
-- =============================================================================

create table if not exists public.newvibes_admin_reviews (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (char_length(trim(title)) between 1 and 100),
  /** トップ表示用の短文レビュー（一覧カードに載るキャッチコピー） */
  summary text not null check (char_length(trim(summary)) between 1 and 200),
  /** 詳細ページに表示する本文（複数段落想定。10,000 字まで） */
  body text not null check (char_length(trim(body)) between 1 and 10000),
  icon_path text check (icon_path is null or char_length(icon_path) <= 500),
  icon_url text check (icon_url is null or char_length(icon_url) <= 1000),
  status text not null default 'published' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newvibes_admin_reviews_published_idx
  on public.newvibes_admin_reviews (published_at desc nulls last)
  where status = 'published';
create index if not exists newvibes_admin_reviews_status_idx
  on public.newvibes_admin_reviews (status);
create index if not exists newvibes_admin_reviews_created_idx
  on public.newvibes_admin_reviews (created_at desc);

-- updated_at 自動更新（既存の共通関数 newvibes_set_updated_at を流用）
drop trigger if exists newvibes_admin_reviews_updated_at on public.newvibes_admin_reviews;
create trigger newvibes_admin_reviews_updated_at
  before update on public.newvibes_admin_reviews
  for each row execute function public.newvibes_set_updated_at();

-- status = 'published' に切り替えた瞬間に published_at を自動セット
create or replace function public.newvibes_admin_reviews_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists newvibes_admin_reviews_publish_at on public.newvibes_admin_reviews;
create trigger newvibes_admin_reviews_publish_at
  before insert or update of status on public.newvibes_admin_reviews
  for each row execute function public.newvibes_admin_reviews_set_published_at();

-- RLS
alter table public.newvibes_admin_reviews enable row level security;

-- SELECT: published は誰でも、draft は管理者のみ
drop policy if exists "newvibes_admin_reviews_select_published_or_admin"
  on public.newvibes_admin_reviews;
create policy "newvibes_admin_reviews_select_published_or_admin"
  on public.newvibes_admin_reviews for select
  using (
    status = 'published'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- INSERT/UPDATE/DELETE: 管理者のみ
drop policy if exists "newvibes_admin_reviews_insert_admin" on public.newvibes_admin_reviews;
create policy "newvibes_admin_reviews_insert_admin"
  on public.newvibes_admin_reviews for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "newvibes_admin_reviews_update_admin" on public.newvibes_admin_reviews;
create policy "newvibes_admin_reviews_update_admin"
  on public.newvibes_admin_reviews for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "newvibes_admin_reviews_delete_admin" on public.newvibes_admin_reviews;
create policy "newvibes_admin_reviews_delete_admin"
  on public.newvibes_admin_reviews for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
