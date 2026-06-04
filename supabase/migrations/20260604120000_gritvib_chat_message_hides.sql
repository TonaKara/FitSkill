-- GritVib: ユーザーごとのメッセージ非表示（自分の画面のみ。相手・DB のメッセージは残る）。
--
-- 会員は自分のスレッドで相手 (operator) のメッセージを非表示にできる。
-- 管理者は任意スレッドで相手 (member) のメッセージを非表示にできる。
-- 自分が送ったメッセージは非表示不可（物理削除を使う）。

create table if not exists public.gritvib_chat_message_hides (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.gritvib_chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index if not exists gritvib_chat_message_hides_user_idx
  on public.gritvib_chat_message_hides (user_id);

alter table public.gritvib_chat_message_hides enable row level security;

drop policy if exists gritvib_chat_message_hides_select_own on public.gritvib_chat_message_hides;
create policy gritvib_chat_message_hides_select_own
  on public.gritvib_chat_message_hides for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists gritvib_chat_message_hides_insert_own on public.gritvib_chat_message_hides;
create policy gritvib_chat_message_hides_insert_own
  on public.gritvib_chat_message_hides for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.gritvib_chat_messages m
      where m.id = message_id
        and m.sender_user_id <> auth.uid()
        and (
          m.thread_member_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true
          )
        )
    )
  );

drop policy if exists gritvib_chat_message_hides_delete_own on public.gritvib_chat_message_hides;
create policy gritvib_chat_message_hides_delete_own
  on public.gritvib_chat_message_hides for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.gritvib_chat_message_hides is
  'GritVib チャットで、閲覧者本人の画面からだけメッセージを隠す記録。';

