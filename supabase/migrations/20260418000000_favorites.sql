-- favorites: スキルお気に入り（1ユーザー1スキル1行）
-- Supabase SQL Editor で実行するか、CLI で適用してください。既に存在する場合は該当行をスキップしてください。

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

create index if not exists favorites_skill_id_idx on public.favorites (skill_id);
create index if not exists favorites_user_id_idx on public.favorites (user_id);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_all" on public.favorites;
create policy "favorites_select_all"
  on public.favorites for select
  using (true);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- Realtime（未追加のときのみ。既に追加済みでエラーになる場合は無視）
alter publication supabase_realtime add table public.favorites;
