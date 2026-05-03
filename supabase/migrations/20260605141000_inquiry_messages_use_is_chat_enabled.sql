-- 取引前チャットは is_chat_enabled のみで制御（事前オファー is_enabled とは分離）

drop policy if exists "inquiry_messages_insert_sender" on public.inquiry_messages;

create policy "inquiry_messages_insert_sender"
  on public.inquiry_messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and sender_id <> recipient_id
    and exists (
      select 1
      from public.skills s
      inner join public.consultation_settings cs on cs.skill_id = s.id
      where s.id = origin_skill_id
        and cs.is_chat_enabled = true
        and (s.user_id = recipient_id or s.user_id = sender_id)
    )
  );
