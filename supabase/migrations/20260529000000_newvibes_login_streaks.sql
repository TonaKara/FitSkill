-- =============================================================================
-- FromHere: 連続ログイン日数（newvibes_login_streaks）
-- =============================================================================
-- ユーザーが /fromhere を訪れた日（JST 0:00 区切り）を 1 日 1 回記録し、
-- 連続日数（current_streak）と最長日数（longest_streak）を保持する。
--
-- - last_login_date は JST の日付（date 型）。
-- - 同日アクセスは no-op、前日続きで +1、それ以前で 1 にリセット。
-- - RLS:
--     - 更新は自分の行のみ。
--     - 閲覧は他者プロフィールのバッジ表示のため public 許可。
--       （ログイン履歴の細部までは公開しないが、連続/最長日数は profile 表示用に公開）
-- =============================================================================

create table if not exists public.newvibes_login_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 1 check (current_streak >= 0),
  longest_streak integer not null default 1 check (longest_streak >= 0),
  last_login_date date not null,
  updated_at timestamptz not null default now()
);

comment on table public.newvibes_login_streaks is
  'FromHere ユーザーの連続ログイン日数。JST 0:00 区切りで 1 日 1 回更新される。';

create index if not exists newvibes_login_streaks_current_idx
  on public.newvibes_login_streaks (current_streak desc);

alter table public.newvibes_login_streaks enable row level security;

drop policy if exists "newvibes_login_streaks_select" on public.newvibes_login_streaks;
create policy "newvibes_login_streaks_select"
  on public.newvibes_login_streaks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "newvibes_login_streaks_insert_self" on public.newvibes_login_streaks;
create policy "newvibes_login_streaks_insert_self"
  on public.newvibes_login_streaks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "newvibes_login_streaks_update_self" on public.newvibes_login_streaks;
create policy "newvibes_login_streaks_update_self"
  on public.newvibes_login_streaks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
