-- skills / transactions に通貨カラム currency を追加。
--
-- # 設計
-- - 既存データはすべて JPY を前提として `price` 列に「整数 yen」が格納されている。
-- - DEFAULT 'JPY' + NOT NULL を付与することで、既存行は自動的に 'JPY' で埋まり、
--   既存ロジック（JPY 前提の RPC・アプリコード）の挙動は完全に変わらない。
-- - 後続のアプリ実装で `price` 列の意味を「currency の最小単位」に再定義する。
--   - currency='JPY': price=1000 → ¥1,000（unchanged）
--   - currency='USD': price=1000 → $10.00（100 cents = $1.00）
--
-- # 既存ユーザーへの影響
-- - ゼロ。全行 'JPY' で埋まり、price の数値も整数 yen のまま意味が変わらない。
-- - 古い RPC（v_skill.price::integer を直接参照する claim_* 系等）も完全に同じ挙動。
--
-- # 値域
-- 現時点では 'JPY' / 'USD' のみ。サポート通貨を追加する際はこの CHECK 制約も更新する。

------------------------------------------------------------
-- skills.currency
------------------------------------------------------------
alter table public.skills
  add column if not exists currency text not null default 'JPY';

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'skills'
      and constraint_name = 'skills_currency_check'
  ) then
    alter table public.skills
      add constraint skills_currency_check
      check (currency in ('JPY', 'USD'));
  end if;
end$$;

comment on column public.skills.currency is
  'スキルの販売通貨（ISO 4217）。DEFAULT ''JPY''。値域は ''JPY'' | ''USD''。'
  '同じ行の price 列は、この currency の最小単位（JPY=yen, USD=cents）で格納する。';

------------------------------------------------------------
-- transactions.currency
------------------------------------------------------------
alter table public.transactions
  add column if not exists currency text not null default 'JPY';

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'transactions'
      and constraint_name = 'transactions_currency_check'
  ) then
    alter table public.transactions
      add constraint transactions_currency_check
      check (currency in ('JPY', 'USD'));
  end if;
end$$;

comment on column public.transactions.currency is
  '取引時点でスナップショットした販売通貨（ISO 4217）。DEFAULT ''JPY''。値域は ''JPY'' | ''USD''。'
  '同じ行の price 列は、この currency の最小単位（JPY=yen, USD=cents）で格納する。'
  'スキル側の通貨が後から変更されても、取引履歴の通貨はこの値が真。';
