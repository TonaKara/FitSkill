-- 購入前チャット: consultation_settings.is_enabled が true のスキルのみ送信可

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
        and cs.is_enabled = true
        and (s.user_id = recipient_id or s.user_id = sender_id)
    )
  );
