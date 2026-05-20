-- profiles に preferred_locale カラムを追加。
-- DEFAULT 'ja' のため既存ユーザーは自動的に日本語のままになり、
-- これまでと完全に同じメール／通知挙動を維持する。
--
-- 新規登録ユーザーは UI 側で英語を選択した時のみ 'en' に更新される。
-- DB に保存される他のデータ（カテゴリ・本文等）は引き続き日本語のまま。

alter table public.profiles
  add column if not exists preferred_locale text not null default 'ja';

-- 値域チェック（'ja' | 'en' のみ許可）
do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_preferred_locale_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_locale_check
      check (preferred_locale in ('ja', 'en'));
  end if;
end$$;

comment on column public.profiles.preferred_locale is
  'ユーザーが選択した言語。Resend メール本文と将来のアプリ内通知本文の出し分けに使用する。既存データへの影響を避けるため DEFAULT ''ja''。値域は ''ja'' | ''en''。UI 側 LanguageSwitcher と同期される。';
