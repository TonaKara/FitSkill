-- 添付のみのメッセージで content を空にできるようにする（file_url がある場合）

alter table public.messages add column if not exists file_url text;
alter table public.messages add column if not exists file_type text;
alter table public.messages add column if not exists is_read boolean not null default false;

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'messages'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%content%';
  if cname is not null then
    execute format('alter table public.messages drop constraint %I', cname);
  end if;
end $$;

alter table public.messages drop constraint if exists messages_content_or_file_check;

alter table public.messages add constraint messages_content_or_file_check check (
  char_length(trim(coalesce(content, ''))) > 0
  or (file_url is not null and trim(coalesce(file_url, '')) <> '')
);
