-- GritVib (人間チャットサービス) のメッセージテーブル。
--
-- 設計:
--   - スレッドはユーザー (= gritvib_chat_members.id = auth.users.id) と 1:1。
--     スレッド ID は別途持たず、`thread_member_id` で直接ユーザーを指す。
--   - 各メッセージは送信者 (`sender_role`) が会員 (`member`) かオペレーター (`operator`) かを保持。
--   - 削除は両側完全削除 (= 物理 DELETE)。Realtime の DELETE イベントで相手側にも反映される。
--   - 自分が送ったメッセージのみ削除可。相手のメッセージは触れない。
--   - メッセージは「テキスト」または「画像」または「両方」を持てる。最低どちらか 1 つは必須。
--   - 画像は別バケット (`gritvib-chat-photos`) のパスを保存する。

create table if not exists public.gritvib_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_member_id uuid not null references public.gritvib_chat_members(id) on delete cascade,
  sender_role text not null check (sender_role in ('member', 'operator')),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz not null default now(),
  constraint gritvib_chat_messages_payload_present
    check (
      (body is not null and length(trim(body)) > 0)
      or (image_path is not null and length(trim(image_path)) > 0)
    )
);

-- スレッドごとに時系列で読みやすいよう (thread_member_id, created_at) でインデックス。
create index if not exists gritvib_chat_messages_thread_created_idx
  on public.gritvib_chat_messages (thread_member_id, created_at);

alter table public.gritvib_chat_messages enable row level security;

-- 自分のスレッドのメッセージは本人が参照可能。
drop policy if exists gritvib_chat_messages_select_self_thread on public.gritvib_chat_messages;
create policy gritvib_chat_messages_select_self_thread
  on public.gritvib_chat_messages for select
  to authenticated
  using (thread_member_id = auth.uid());

-- admin (profiles.is_admin = true) は全スレッドのメッセージを参照可能。
drop policy if exists gritvib_chat_messages_select_admin on public.gritvib_chat_messages;
create policy gritvib_chat_messages_select_admin
  on public.gritvib_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 会員 (member) の送信: 自分のスレッドにのみ、自分名義で送れる。
-- かつサブスクが有効でなければ INSERT 不可。
drop policy if exists gritvib_chat_messages_insert_member on public.gritvib_chat_messages;
create policy gritvib_chat_messages_insert_member
  on public.gritvib_chat_messages for insert
  to authenticated
  with check (
    sender_role = 'member'
    and sender_user_id = auth.uid()
    and thread_member_id = auth.uid()
    and public.gritvib_chat_member_can_send(auth.uid())
  );

-- オペレーター (operator) の送信: admin が任意のスレッドに自分名義で送れる。
drop policy if exists gritvib_chat_messages_insert_operator on public.gritvib_chat_messages;
create policy gritvib_chat_messages_insert_operator
  on public.gritvib_chat_messages for insert
  to authenticated
  with check (
    sender_role = 'operator'
    and sender_user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- 削除: 自分が送ったメッセージのみ (両側完全削除なので物理 DELETE)。
drop policy if exists gritvib_chat_messages_delete_own on public.gritvib_chat_messages;
create policy gritvib_chat_messages_delete_own
  on public.gritvib_chat_messages for delete
  to authenticated
  using (sender_user_id = auth.uid());

-- 更新は許可しない (UPDATE policy 未作成)。編集機能は仕様外。

-- Realtime 配信用 publication にこのテーブルを登録する。
-- `supabase_realtime` は Supabase が自動で作成する logical replication publication で、
-- ここに追加されたテーブルの INSERT / UPDATE / DELETE がクライアントの Realtime channel に流れる。
-- DELETE イベントを受け取るには `replica identity full` も必要。
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gritvib_chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.gritvib_chat_messages';
  end if;
end $$;

alter table public.gritvib_chat_messages replica identity full;

comment on table public.gritvib_chat_messages is
  'GritVib のチャットメッセージ。スレッドはユーザー (gritvib_chat_members) と 1:1。両側完全削除のため物理 DELETE。';
comment on column public.gritvib_chat_messages.thread_member_id is
  'このメッセージが属するスレッドのユーザー (gritvib_chat_members.id = auth.users.id)。';
comment on column public.gritvib_chat_messages.sender_role is
  '送信者の役割。"member" (= スレッドのユーザー本人) か "operator" (= admin) のいずれか。';
comment on column public.gritvib_chat_messages.sender_user_id is
  '送信者の auth.users.id。';
comment on column public.gritvib_chat_messages.image_path is
  '画像メッセージ時のストレージパス (gritvib-chat-photos バケット内)。テキストのみの場合は NULL。';
