-- 異議の解決状態・返金ステータス、および管理者の参照・更新用 RLS

-- 1. transactions.status にアプリで使用する値を反映
alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check check (
    status in ('active', 'completed', 'approval_pending', 'disputed', 'refunded')
  );

-- 2. 申し立ての対応結果（null = 未申立てまたはレガシー行）
alter table public.transactions add column if not exists dispute_status text;

alter table public.transactions drop constraint if exists transactions_dispute_status_check;
alter table public.transactions
  add constraint transactions_dispute_status_check check (
    dispute_status is null or dispute_status in ('open', 'resolved', 'rejected')
  );

update public.transactions
set dispute_status = 'open'
where disputed_at is not null
  and status = 'disputed'
  and dispute_status is null;

-- 3. 買い手による取引更新（完了申請・異議など）
drop policy if exists "transactions_update_buyer" on public.transactions;
create policy "transactions_update_buyer"
  on public.transactions for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

-- 4. 管理者: 全取引の参照・更新（異議対応・返金）
drop policy if exists "transactions_select_admin" on public.transactions;
create policy "transactions_select_admin"
  on public.transactions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "transactions_update_admin" on public.transactions;
create policy "transactions_update_admin"
  on public.transactions for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

-- 5. 管理者: 当事者以外の取引のメッセージ閲覧（管理モーダル用）
drop policy if exists "messages_select_admin" on public.messages;
create policy "messages_select_admin"
  on public.messages for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );
