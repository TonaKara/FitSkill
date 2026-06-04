-- GritVib (人間チャットサービス) 会員プロファイル。
--
-- 設計:
--   - 旧サイト (`profiles`) と分離するために独自テーブルを用意し、Supabase Auth の `auth.users`
--     と 1:1 で紐づける。
--   - ニックネームは case-insensitive で一意。後から変更不可（UPDATE は許可しない）。
--   - レコードはユーザー本人がメール確認後に `/talk/onboard` で挿入する。
--   - 退会時は `auth.users` 削除に追従 (ON DELETE CASCADE)。

create table if not exists public.gritvib_chat_members (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ニックネームの一意性は大文字小文字を区別しない（"Taro" と "taro" は同一視）。
create unique index if not exists gritvib_chat_members_nickname_lower_unique
  on public.gritvib_chat_members ((lower(nickname)));

create or replace function public.gritvib_chat_members_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gritvib_chat_members_set_updated_at on public.gritvib_chat_members;
create trigger trg_gritvib_chat_members_set_updated_at
  before update on public.gritvib_chat_members
  for each row
  execute function public.gritvib_chat_members_set_updated_at();

alter table public.gritvib_chat_members enable row level security;

-- 本人は自分のレコードを参照可能。
drop policy if exists gritvib_chat_members_select_self on public.gritvib_chat_members;
create policy gritvib_chat_members_select_self
  on public.gritvib_chat_members for select
  to authenticated
  using (auth.uid() = id);

-- admin (profiles.is_admin = true) は全件参照可能（運営側 UI 用）。
drop policy if exists gritvib_chat_members_select_admin on public.gritvib_chat_members;
create policy gritvib_chat_members_select_admin
  on public.gritvib_chat_members for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 本人は自分のレコードを作成可能 (onboard 用)。
drop policy if exists gritvib_chat_members_insert_self on public.gritvib_chat_members;
create policy gritvib_chat_members_insert_self
  on public.gritvib_chat_members for insert
  to authenticated
  with check (auth.uid() = id);

-- 更新ポリシーは敢えて作成しない（=不可）。ニックネーム変更不可仕様を DB レベルで保証する。

-- 重複事前チェック用の関数。
-- 認証済みユーザーがフォーム入力時に呼び出して「使えるかどうか」を確認するための軽量版。
-- 本物の一意性は INSERT 時の unique index で担保され、ここはあくまでも UX のための先読み。
create or replace function public.gritvib_chat_members_is_nickname_taken(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.gritvib_chat_members
    where lower(nickname) = lower(p_nickname)
  );
$$;

grant execute on function public.gritvib_chat_members_is_nickname_taken(text) to authenticated;

comment on table public.gritvib_chat_members is
  'GritVib (人間チャットサービス) の会員プロファイル。旧サイトの profiles とは独立。ニックネームは case-insensitive で一意、変更不可。';
comment on column public.gritvib_chat_members.nickname is
  'GritVib 内で運営者のみが視認するニックネーム。case-insensitive で一意、登録後の変更不可。';
comment on function public.gritvib_chat_members_is_nickname_taken(text) is
  'GritVib のニックネームが既に使われているかを確認する関数。フォーム入力時の事前チェック用。本来の一意性は INSERT 時の unique index で保証される。';
