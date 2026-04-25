-- ratings 挿入時トリガーを停止（アプリ側で集計更新を行う）

drop trigger if exists tr_ratings_after_insert on public.ratings;
drop function if exists public.on_transaction_review_after_insert();
