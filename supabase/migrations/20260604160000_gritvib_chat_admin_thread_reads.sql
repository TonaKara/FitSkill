-- GritVib 管理画面: 運営がスレッドを開いた時刻（既読）を永続化する。
--
-- 未読件数 = 「最後の operator 返信より後」かつ「運営の last read_at より後」の member メッセージ数。
--
-- 依存: gritvib_chat_members。RLS で gritvib_is_gritvib_admin() を使用するため、
-- 20260604130000 未適用の環境向けにここでも関数を定義する。

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

drop policy if exists gritvib_chat_admin_thread_reads_upsert_own on public.gritvib_chat_admin_thread_reads;
create policy gritvib_chat_admin_thread_reads_upsert_own
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

comment on table public.gritvib_chat_admin_thread_reads is
  'GritVib 管理画面で運営がスレッドを開いた時刻。未読集計に利用する。';

revoke all on table public.gritvib_chat_admin_thread_reads from anon;
grant select, insert, update on table public.gritvib_chat_admin_thread_reads to authenticated;

