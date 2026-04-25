alter table public.notifications
  add column if not exists is_admin_origin boolean not null default false;

create index if not exists notifications_recipient_admin_idx
  on public.notifications (recipient_id, is_admin_origin, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_admin_select" on public.announcements;
create policy "announcements_admin_select"
  on public.announcements for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "announcements_admin_insert" on public.announcements;
create policy "announcements_admin_insert"
  on public.announcements for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.create_admin_notification(
  p_recipient_id uuid,
  p_transaction_id bigint,
  p_type text,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_is_admin boolean;
begin
  v_sender := auth.uid();
  if v_sender is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select coalesce(p.is_admin, false)
  into v_is_admin
  from public.profiles p
  where p.id = v_sender;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  if p_recipient_id = v_sender then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;

  insert into public.notifications (
    recipient_id,
    transaction_id,
    sender_id,
    type,
    content,
    is_admin_origin,
    is_read
  )
  values (
    p_recipient_id,
    p_transaction_id,
    v_sender,
    p_type,
    p_content,
    true,
    false
  );
end;
$$;

grant execute on function public.create_admin_notification(uuid, bigint, text, text) to authenticated;

create or replace function public.create_announcement_and_notify(
  p_title text,
  p_content text,
  p_target_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_is_admin boolean;
  v_announcement_id uuid;
begin
  v_sender := auth.uid();
  if v_sender is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select coalesce(p.is_admin, false)
  into v_is_admin
  from public.profiles p
  where p.id = v_sender;

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0001';
  end if;

  insert into public.announcements (created_by, target_user_id, title, content)
  values (v_sender, p_target_user_id, p_title, p_content)
  returning id into v_announcement_id;

  if p_target_user_id is not null then
    if p_target_user_id <> v_sender then
      insert into public.notifications (
        recipient_id,
        transaction_id,
        sender_id,
        type,
        content,
        is_admin_origin,
        is_read
      )
      values (
        p_target_user_id,
        null,
        v_sender,
        'announcement',
        p_content,
        true,
        false
      );
    end if;
  else
    insert into public.notifications (
      recipient_id,
      transaction_id,
      sender_id,
      type,
      content,
      is_admin_origin,
      is_read
    )
    select
      p.id,
      null,
      v_sender,
      'announcement',
      p_content,
      true,
      false
    from public.profiles p
    where p.id <> v_sender;
  end if;

  return v_announcement_id;
end;
$$;

grant execute on function public.create_announcement_and_notify(text, text, uuid) to authenticated;
