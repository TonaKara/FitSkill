create or replace function public.complete_transaction(tx_id int8)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transactions
  set
    status = 'completed',
    completed_at = now(),
    auto_complete_at = null
  where id = tx_id;
end;
$$;
