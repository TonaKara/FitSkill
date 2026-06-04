-- GritVib: 途中失敗で欠けたオブジェクトを修復する（SQL Editor 個別実行向け）。
-- 20260604120000 / 20260604130000 が部分適用された環境でも安全に再実行できる。

-- gritvib_is_gritvib_admin
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
grant execute on function public.gritvib_is_gritvib_admin() to service_role;

-- gritvib_chat_message_hides
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
          or public.gritvib_is_gritvib_admin()
        )
    )
  );

drop policy if exists gritvib_chat_message_hides_delete_own on public.gritvib_chat_message_hides;
create policy gritvib_chat_message_hides_delete_own
  on public.gritvib_chat_message_hides for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.gritvib_chat_message_hides from anon;
grant select, insert, delete on table public.gritvib_chat_message_hides to authenticated;

-- gritvib_chat_admin_thread_reads（既読）
create table if not exists public.gritvib_chat_admin_thread_reads (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  thread_member_id uuid not null references public.gritvib_chat_members(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_user_id, thread_member_id)
);

create index if not exists gritvib_chat_admin_thread_reads_admin_idx
  on public.gritvib_chat_admin_thread_reads (admin_user_id);

alter table public.gritvib_chat_admin_thread_reads enable row level security;

drop policy if exists gritvib_chat_admin_thread_reads_select_own on public.gritvib_chat_admin_thread_reads;
create policy gritvib_chat_admin_thread_reads_select_own
  on public.gritvib_chat_admin_thread_reads for select
  to authenticated
  using (admin_user_id = auth.uid() and public.gritvib_is_gritvib_admin());

drop policy if exists gritvib_chat_admin_thread_reads_insert_own on public.gritvib_chat_admin_thread_reads;
create policy gritvib_chat_admin_thread_reads_insert_own
  on public.gritvib_chat_admin_thread_reads for insert
  to authenticated
  with check (
    admin_user_id = auth.uid()
    and public.gritvib_is_gritvib_admin()
    and exists (
      select 1 from public.gritvib_chat_members m where m.id = thread_member_id
    )
  );

drop policy if exists gritvib_chat_admin_thread_reads_update_own on public.gritvib_chat_admin_thread_reads;
create policy gritvib_chat_admin_thread_reads_update_own
  on public.gritvib_chat_admin_thread_reads for update
  to authenticated
  using (admin_user_id = auth.uid() and public.gritvib_is_gritvib_admin())
  with check (admin_user_id = auth.uid() and public.gritvib_is_gritvib_admin());

revoke all on table public.gritvib_chat_admin_thread_reads from anon;
grant select, insert, update on table public.gritvib_chat_admin_thread_reads to authenticated;
