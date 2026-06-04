-- profiles.is_admin: クライアント経由の昇格（true 化）を拒否し、剥奪（false 化）は常に許可する。
-- true への付与は service_role（Supabase ダッシュボード / サーバー運用）のみ。

create or replace function public.profiles_is_privileged_for_is_admin_write()
returns boolean
language sql
stable
as $$
  select current_setting('role', true) in ('service_role', 'supabase_admin')
      or session_user in ('service_role', 'supabase_admin', 'postgres');
$$;

create or replace function public.enforce_profiles_is_admin_client_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) = true
       and not public.profiles_is_privileged_for_is_admin_write() then
      raise exception 'is_admin cannot be set on insert by authenticated clients'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_admin is not distinct from old.is_admin then
      return new;
    end if;

    -- 剥奪（false / null 扱い）は常に許可（本人・管理者・運用いずれも）
    if coalesce(new.is_admin, false) = false then
      return new;
    end if;

    -- true への昇格は service_role 等のみ
    if not public.profiles_is_privileged_for_is_admin_write() then
      raise exception 'is_admin cannot be promoted via authenticated clients'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_is_admin_writes on public.profiles;
create trigger trg_profiles_enforce_is_admin_writes
  before insert or update of is_admin on public.profiles
  for each row
  execute function public.enforce_profiles_is_admin_client_writes();

comment on function public.enforce_profiles_is_admin_client_writes() is
  'is_admin のクライアント昇格を拒否。false への剥奪は常に許可。true 付与は service_role のみ。';
