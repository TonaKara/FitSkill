-- メッセージ本文カラムを content に統一（既存 DB が body の場合のみリネーム）

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'body'
  ) then
    alter table public.messages rename column body to content;
  end if;
end $$;
