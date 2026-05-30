-- FromHere: 運営による「非公開化」フラグを newvibes_products に追加する。
--
-- 背景:
-- - 投稿者 (maker) が status を draft / published / archived に切り替えられる仕組みは既存。
-- - 利用規約違反などの理由で運営側が非表示にしたい場合、status を archived にしてもユーザー側で
--   いつでも published に戻せてしまうため、運営判断の非公開が維持されない。
-- - そこで「運営による非公開化」を表す独立カラム `admin_hidden_at` を導入し、これが NOT NULL の
--   間はユーザー側 (Server Action) で status 変更を拒否する運用にする。
--
-- 設計:
-- - `admin_hidden_at` (タイムスタンプ): 非公開化された時刻。NULL なら通常状態。
-- - `admin_hidden_by` (uuid): 操作した管理者 (auth.users.id)。auth.users 削除時は SET NULL。
-- - `admin_hidden_reason` (text): 任意の理由メモ。後から監査するため残しておく。
-- - 一般ユーザー向けクエリでは `admin_hidden_at is null` を条件に加える。本人 (maker) には
--   表示してよいが、status 変更や復活は Server Action 側で拒否する。

alter table public.newvibes_products
  add column if not exists admin_hidden_at timestamptz,
  add column if not exists admin_hidden_by uuid references auth.users (id) on delete set null,
  add column if not exists admin_hidden_reason text;

create index if not exists newvibes_products_admin_hidden_at_idx
  on public.newvibes_products (admin_hidden_at);
