-- FromHere コメント本文の上限を 2000 → 400 文字に変更する。
--
-- 設計上の注意:
-- - クライアント / サーバー側 (`_comment-validation.ts`) の `FROMHERE_COMMENT_MAX_LENGTH`
--   と一致している必要がある（DB は最後の砦としての二重検証）。
-- - 既存の CHECK 制約は無名で作成されているケースがあるため、命名規約に頼らず
--   `pg_constraint` から定義文を辿って drop する。
-- - 既存データが 400 字を超えていた場合に ADD CONSTRAINT が失敗するのを防ぐため、
--   `NOT VALID` で追加する。新規 / 更新行は 400 字制限が適用され、既存の長文は保持される。
--   将来的に整合させたければ `ALTER TABLE ... VALIDATE CONSTRAINT` を別マイグレーションで実施する。

do $$
declare
  conname text;
begin
  for conname in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'newvibes_comments'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%char_length%body%'
  loop
    execute format('alter table public.newvibes_comments drop constraint %I', conname);
  end loop;
end$$;

alter table public.newvibes_comments
  add constraint newvibes_comments_body_length_check
  check (char_length(trim(body)) between 1 and 400) not valid;
