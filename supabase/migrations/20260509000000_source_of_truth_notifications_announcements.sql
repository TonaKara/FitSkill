-- Source of truth: notifications に title 列はない。announcements に created_by はない（正スキーマに揃える）。

alter table public.notifications
  drop column if exists title;

alter table public.announcements
  drop column if exists created_by;

drop policy if exists "announcements_admin_insert" on public.announcements;
create policy "announcements_admin_insert"
  on public.announcements for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop function if exists public.create_announcement_and_notify(text, text, text, uuid);
drop function if exists public.create_announcement_and_notify(text, text, uuid);

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
  v_user_body text;
  v_notif text;
  v_nl int;
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

  v_user_body := p_content;
  if p_content ~ '^\s*理由[:：]' then
    v_nl := position(E'\n' in p_content);
    if v_nl > 0 then
      v_user_body := btrim(substring(p_content from v_nl + 1));
    else
      v_user_body := '';
    end if;
  end if;
  v_notif := p_title;
  if btrim(v_user_body) <> '' then
    v_notif := p_title || E'\n\n' || btrim(v_user_body);
  end if;

  insert into public.announcements (title, content, target_user_id)
  values (p_title, p_content, p_target_user_id)
  returning id into v_announcement_id;

  if p_target_user_id is not null then
    if p_target_user_id <> v_sender then
      insert into public.notifications (
        recipient_id,
        sender_id,
        type,
        content,
        is_admin_origin,
        is_read
      )
      values (
        p_target_user_id,
        v_sender,
        'announcement',
        v_notif,
        true,
        false
      );
    end if;
  else
    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      content,
      is_admin_origin,
      is_read
    )
    select
      p.id,
      v_sender,
      'announcement',
      v_notif,
      true,
      false
    from public.profiles p
    where p.id <> v_sender;
  end if;

  return v_announcement_id;
end;
$$;

grant execute on function public.create_announcement_and_notify(text, text, uuid) to authenticated;
