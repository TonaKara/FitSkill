-- 相談リクエスト（事前オファー）機能

create table if not exists public.consultation_settings (
  skill_id bigint primary key references public.skills (id) on delete cascade,
  q1_label text,
  q2_label text,
  q3_label text,
  free_label text,
  is_enabled boolean not null default false
);

alter table public.consultation_settings enable row level security;

drop policy if exists "consultation_settings_select_all" on public.consultation_settings;
create policy "consultation_settings_select_all"
  on public.consultation_settings for select
  using (true);

drop policy if exists "consultation_settings_insert_owner" on public.consultation_settings;
create policy "consultation_settings_insert_owner"
  on public.consultation_settings for insert
  with check (
    exists (
      select 1
      from public.skills s
      where s.id = consultation_settings.skill_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "consultation_settings_update_owner" on public.consultation_settings;
create policy "consultation_settings_update_owner"
  on public.consultation_settings for update
  using (
    exists (
      select 1
      from public.skills s
      where s.id = consultation_settings.skill_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.skills s
      where s.id = consultation_settings.skill_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "consultation_settings_delete_owner" on public.consultation_settings;
create policy "consultation_settings_delete_owner"
  on public.consultation_settings for delete
  using (
    exists (
      select 1
      from public.skills s
      where s.id = consultation_settings.skill_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.consultation_answers (
  id uuid primary key default gen_random_uuid(),
  skill_id bigint not null references public.skills (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  a1_text text,
  a2_text text,
  a3_text text,
  free_text text,
  status text not null default 'pending',
  rejection_reason text,
  constraint consultation_answers_status_check
    check (status in ('pending', 'accepted', 'rejected')),
  constraint consultation_answers_one_per_buyer unique (skill_id, buyer_id)
);

create index if not exists consultation_answers_skill_id_idx
  on public.consultation_answers (skill_id);
create index if not exists consultation_answers_buyer_id_idx
  on public.consultation_answers (buyer_id);

alter table public.consultation_answers enable row level security;

drop policy if exists "consultation_answers_select_parties" on public.consultation_answers;
create policy "consultation_answers_select_parties"
  on public.consultation_answers for select
  using (
    buyer_id = auth.uid()
    or exists (
      select 1
      from public.skills s
      where s.id = consultation_answers.skill_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "consultation_answers_insert_buyer" on public.consultation_answers;
create policy "consultation_answers_insert_buyer"
  on public.consultation_answers for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1
      from public.consultation_settings cs
      where cs.skill_id = consultation_answers.skill_id
        and cs.is_enabled = true
    )
    and exists (
      select 1
      from public.skills s
      where s.id = consultation_answers.skill_id
        and s.user_id <> auth.uid()
    )
  );

drop policy if exists "consultation_answers_update_buyer_or_seller" on public.consultation_answers;
create policy "consultation_answers_update_buyer_or_seller"
  on public.consultation_answers for update
  using (
    buyer_id = auth.uid()
    or exists (
      select 1
      from public.skills s
      where s.id = consultation_answers.skill_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    (
      buyer_id = auth.uid()
      and status = 'pending'
      and rejection_reason is null
    )
    or (
      exists (
        select 1
        from public.skills s
        where s.id = consultation_answers.skill_id
          and s.user_id = auth.uid()
      )
      and status in ('accepted', 'rejected')
    )
  );

-- 購入制御: 相談設定が有効なスキルは、accepted の回答がある買い手のみ購入可。
drop policy if exists "transactions_insert_as_buyer" on public.transactions;
create policy "transactions_insert_as_buyer"
  on public.transactions for insert
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
    and (
      not exists (
        select 1
        from public.consultation_settings cs
        where cs.skill_id = transactions.skill_id
          and cs.is_enabled = true
      )
      or exists (
        select 1
        from public.consultation_answers ca
        where ca.skill_id = transactions.skill_id
          and ca.buyer_id = auth.uid()
          and ca.status = 'accepted'
      )
    )
  );
