-- 同一スキル・同一購入者で「決済待ち」が複数行になると二重決済・取引不整合の原因になるため、
-- awaiting_payment は最大1件に制限する（完了済み・キャンセル後の再購入は別行で許可される）。

create unique index if not exists transactions_skill_buyer_awaiting_payment_uidx
  on public.transactions (skill_id, buyer_id)
  where status = 'awaiting_payment';
