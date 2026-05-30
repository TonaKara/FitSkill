-- =============================================================================
-- FromHere: ハンドル変更を「初回設定後は不可」に変更
-- =============================================================================
-- 仕様変更: GritVib 本体の「カスタムID」と同様、一度設定したハンドルは
--           変更も削除もできないようにする（運用負荷とトラブル防止のため）。
--
-- - 既存トリガー `newvibes_profiles_check_handle_change` は「1 回まで変更可」
--   をルールにしていたが、ここでは UPDATE 時に handle が変わったら常に例外を
--   投げるロジックに置き換える。
-- - INSERT 時には UPDATE トリガーは発火しないので新規作成は引き続き許可される。
-- - `handle_change_count` カラムは互換のため残す（今後は常に 0 を維持）。
-- =============================================================================

create or replace function public.newvibes_check_handle_change_limit()
returns trigger
language plpgsql
as $$
begin
  /**
   * UPDATE のみで呼び出される前提（下のトリガー定義で BEFORE UPDATE OF handle に限定）。
   * - OLD.handle と NEW.handle が異なれば常に例外。
   * - 同じ値であれば handle_change_count / handle_changed_at は触らない。
   */
  if old.handle is distinct from new.handle then
    raise exception 'Handle cannot be changed after initial setup.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists newvibes_profiles_check_handle_change on public.newvibes_profiles;
create trigger newvibes_profiles_check_handle_change
  before update of handle on public.newvibes_profiles
  for each row execute function public.newvibes_check_handle_change_limit();
