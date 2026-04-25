-- アプリを直接クエリに切り替えたため、旧 RPC を削除（未作成なら何もしない）

drop function if exists public.get_my_active_transaction_id_for_skill(uuid);
drop function if exists public.count_active_transactions_for_skill(uuid);
