-- =============================================================================
-- newvibes_profiles の avatar 系カラムを保証する修復マイグレーション。
--
-- 背景:
--   20260528181000_newvibes_init.sql で `avatar_url` / `avatar_path` カラムが
--   定義されているが、既に古いバージョンを適用済みで `avatar_url` のみだったり、
--   どちらも存在しない環境がある。
--   そのままだと SSR 側の `select("id, handle, ..., avatar_url, avatar_path")` が
--   error になり、`/fromhere/u/<handle>` で「メーカーが見つかりません」、
--   `/fromhere/settings` や `/fromhere/profile/edit` が onboarding に飛ぶ。
--
-- このマイグレーションは何度実行しても安全（`add column if not exists`）。
-- =============================================================================

alter table public.newvibes_profiles
  add column if not exists avatar_url text;

alter table public.newvibes_profiles
  add column if not exists avatar_path text;

-- 長さ制約。重複追加を避けるため do block で存在チェック。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newvibes_profiles_avatar_url_length_check'
  ) then
    alter table public.newvibes_profiles
      add constraint newvibes_profiles_avatar_url_length_check
      check (avatar_url is null or char_length(avatar_url) <= 500);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'newvibes_profiles_avatar_path_length_check'
  ) then
    alter table public.newvibes_profiles
      add constraint newvibes_profiles_avatar_path_length_check
      check (avatar_path is null or char_length(avatar_path) <= 500);
  end if;
end$$;
