-- profiles の Stripe 列を守る BEFORE UPDATE トリガーが、プロジェクト外で追加されていると、
-- service_role（Server Action / Edge / webhook）経由の UPDATE で auth.uid() が NULL のため
-- `Unauthorized`（SQLSTATE P0001 相当）で失敗することがあります。
-- 関数定義に stripe_connect と拒否系文言が含まれるユーザートリガーのみ削除します。

do $$
declare
  r record;
  v_def text;
begin
  for r in
    select
      t.tgname as tgname,
      p.oid as fn_oid
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  loop
    begin
      v_def := pg_get_functiondef(r.fn_oid);
    exception
      when others then
        v_def := '';
    end;

    if lower(coalesce(v_def, '')) like '%stripe_connect%'
      and (
        lower(v_def) like '%unauthorized%'
        or lower(v_def) like '%not allowed%'
        or lower(v_def) like '%forbidden%'
      )
    then
      execute format('drop trigger if exists %I on public.profiles', r.tgname);
      raise notice 'Dropped trigger public.profiles.%', r.tgname;
    end if;
  end loop;
end $$;
