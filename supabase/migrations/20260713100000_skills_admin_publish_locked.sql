-- 運営による非公開を記録し、出品者自身の再公開を防ぐ。

alter table public.skills
  add column if not exists admin_publish_locked boolean not null default false;

create or replace function public.guard_skills_admin_publish_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  if auth.uid() is null then
    return NEW;
  end if;

  if coalesce(NEW.admin_publish_locked, false) is distinct from coalesce(OLD.admin_publish_locked, false) then
    select coalesce(p.is_admin, false)
      into v_is_admin
    from public.profiles p
    where p.id = auth.uid();

    if not coalesce(v_is_admin, false) then
      NEW.admin_publish_locked := OLD.admin_publish_locked;
    end if;
  end if;

  if coalesce(OLD.admin_publish_locked, false)
     and coalesce(NEW.is_published, false) = true
     and coalesce(OLD.is_published, false) = false
     and auth.uid() = OLD.user_id then
    raise exception 'admin_publish_locked' using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists skills_guard_admin_publish_locked on public.skills;
create trigger skills_guard_admin_publish_locked
  before update on public.skills
  for each row
  execute function public.guard_skills_admin_publish_locked();
