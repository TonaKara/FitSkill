-- プロフィール設定保存でよく落ちるケースの補強（カラムがあるときだけ実行）

-- status … 新規行で NOT NULL のときなど
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'status'
  ) then
    execute 'alter table public.profiles alter column status set default ''active''';
  end if;
end $$;

-- category が text[] のときの空配列既定（未選択でも INSERT 可能に）
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'category' and udt_name = '_text'
  ) then
    execute 'alter table public.profiles alter column category set default array[]::text[]';
  end if;
end $$;
