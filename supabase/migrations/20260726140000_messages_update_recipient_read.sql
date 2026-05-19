-- 取引チャット: 受信者のみ is_read を更新可能（既読）。Realtime UPDATE で送信者に既読を反映する前提。

drop policy if exists "messages_update_recipient_read" on public.messages;
create policy "messages_update_recipient_read"
  on public.messages for update
  to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.transactions t
      where t.id = messages.transaction_id
        and ((select auth.uid()) = t.buyer_id or (select auth.uid()) = t.seller_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.transactions t
      where t.id = messages.transaction_id
        and ((select auth.uid()) = t.buyer_id or (select auth.uid()) = t.seller_id)
    )
  );

create or replace function public.messages_limit_update_to_read()
returns trigger
language plpgsql
as $$
begin
  if (
    new.id is distinct from old.id
    or new.transaction_id is distinct from old.transaction_id
    or new.sender_id is distinct from old.sender_id
    or new.content is distinct from old.content
    or new.file_url is distinct from old.file_url
    or new.file_type is distinct from old.file_type
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'messages: only is_read may be updated';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_limit_update on public.messages;
create trigger messages_limit_update
  before update on public.messages
  for each row
  execute function public.messages_limit_update_to_read();
