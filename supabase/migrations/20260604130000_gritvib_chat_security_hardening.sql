-- GritVib チャットのセキュリティ強化。
--
-- 方針:
--   - メッセージ閲覧: スレッド本人 (thread_member_id = auth.uid()) または GritVib 管理者のみ
--   - 他ユーザーのスレッド・メッセージ・画像への直接アクセスを RLS で拒否
--   - gritvib_chat_member_can_send は本人 (または管理者) の member_id のみ照会可
--   - ストレージ: 自分のスレッドに紐づく image_path のみ会員が読める（運営添付画像を含む）

-- ---------------------------------------------------------------------------
-- 管理者判定 (RLS / RPC で共通利用)
-- ---------------------------------------------------------------------------
create or replace function public.gritvib_is_gritvib_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  );
$$;

revoke all on function public.gritvib_is_gritvib_admin() from public;
grant execute on function public.gritvib_is_gritvib_admin() to authenticated;

comment on function public.gritvib_is_gritvib_admin() is
  'GritVib 管理画面用。profiles.is_admin = true の認証ユーザーのみ true。';

-- ---------------------------------------------------------------------------
-- 送信可否 RPC: 他人のサブスク状態を推測できないよう制限
-- ---------------------------------------------------------------------------
create or replace function public.gritvib_chat_member_can_send(p_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_member_id is null then
    return false;
  end if;
  if p_member_id is distinct from auth.uid() and not public.gritvib_is_gritvib_admin() then
    return false;
  end if;

  return exists (
    select 1
    from public.gritvib_chat_members m
    where m.id = p_member_id
      and m.subscription_status in ('active', 'trialing')
      and (
        m.subscription_current_period_end is null
        or m.subscription_current_period_end > now()
      )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- gritvib_chat_messages: SELECT を一本化、DELETE をスレッド境界で強化
-- ---------------------------------------------------------------------------
drop policy if exists gritvib_chat_messages_select_self_thread on public.gritvib_chat_messages;
drop policy if exists gritvib_chat_messages_select_admin on public.gritvib_chat_messages;
drop policy if exists gritvib_chat_messages_select on public.gritvib_chat_messages;

create policy gritvib_chat_messages_select
  on public.gritvib_chat_messages for select
  to authenticated
  using (
    thread_member_id = auth.uid()
    or public.gritvib_is_gritvib_admin()
  );

drop policy if exists gritvib_chat_messages_delete_own on public.gritvib_chat_messages;
create policy gritvib_chat_messages_delete_own
  on public.gritvib_chat_messages for delete
  to authenticated
  using (
    sender_user_id = auth.uid()
    and (
      thread_member_id = auth.uid()
      or public.gritvib_is_gritvib_admin()
    )
  );

-- operator INSERT: 対象会員が gritvib_chat_members に存在すること
drop policy if exists gritvib_chat_messages_insert_operator on public.gritvib_chat_messages;
create policy gritvib_chat_messages_insert_operator
  on public.gritvib_chat_messages for insert
  to authenticated
  with check (
    sender_role = 'operator'
    and sender_user_id = auth.uid()
    and public.gritvib_is_gritvib_admin()
    and exists (
      select 1
      from public.gritvib_chat_members m
      where m.id = thread_member_id
    )
  );

-- ---------------------------------------------------------------------------
-- gritvib_chat_message_hides (20260604120000 未適用時のフォールバック)
-- drop policy はテーブル未作成だと失敗するため、先にテーブルを用意する。
-- ---------------------------------------------------------------------------
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

drop policy if exists gritvib_chat_message_hides_delete_own on public.gritvib_chat_message_hides;
create policy gritvib_chat_message_hides_delete_own
  on public.gritvib_chat_message_hides for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- gritvib_chat_members / hides: 管理者判定を共通関数に
-- ---------------------------------------------------------------------------
drop policy if exists gritvib_chat_members_select_admin on public.gritvib_chat_members;
create policy gritvib_chat_members_select_admin
  on public.gritvib_chat_members for select
  to authenticated
  using (public.gritvib_is_gritvib_admin());

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
          or public.gritvib_is_gritvib_admin()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- gritvib_admin_get_member_emails: 共通関数で権限チェック
-- ---------------------------------------------------------------------------
create or replace function public.gritvib_admin_get_member_emails(p_member_id uuid default null)
returns table(member_id uuid, email text)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  ) then
    raise exception 'forbidden'
      using errcode = '42501';
  end if;

  return query
    select m.id, u.email
      from public.gritvib_chat_members m
      left join auth.users u on u.id = m.id
     where p_member_id is null or m.id = p_member_id;
end;
$$;

revoke all on function public.gritvib_admin_get_member_emails(uuid) from public;
grant execute on function public.gritvib_admin_get_member_emails(uuid) to authenticated;
grant execute on function public.gritvib_admin_get_member_emails(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: 会員は自分のスレッドに紐づく画像のみ SELECT
-- ---------------------------------------------------------------------------
drop policy if exists "gritvib_chat_photos_select" on storage.objects;
create policy "gritvib_chat_photos_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gritvib-chat-photos'
    and (
      public.gritvib_is_gritvib_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
      )
      or exists (
        select 1
        from public.gritvib_chat_messages m
        where m.thread_member_id = auth.uid()
          and m.image_path = name
      )
    )
  );

-- ---------------------------------------------------------------------------
-- anon からの直接テーブル操作を明示的に拒否
-- ---------------------------------------------------------------------------
revoke all on table public.gritvib_chat_members from anon;
revoke all on table public.gritvib_chat_messages from anon;
revoke all on table public.gritvib_chat_message_hides from anon;

grant select, insert on table public.gritvib_chat_members to authenticated;
grant select, insert, delete on table public.gritvib_chat_messages to authenticated;
grant select, insert, delete on table public.gritvib_chat_message_hides to authenticated;

