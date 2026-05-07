-- profiles.custom_id を追加（任意・一意・URL向け）
-- 仕様:
-- - 任意（NULL 可）
-- - 英小文字で開始
-- - 3〜30 文字
-- - 使用可能文字: 英小文字 / 数字 / "_" / "-"
-- - 大文字入力は保存時に小文字化
-- - 予約語は利用不可

alter table public.profiles
  add column if not exists custom_id text;

create or replace function public.normalize_profile_custom_id()
returns trigger
language plpgsql
as $$
begin
  if new.custom_id is not null then
    new.custom_id := lower(trim(both from new.custom_id));
    if new.custom_id = '' then
      new.custom_id := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_custom_id on public.profiles;
create trigger trg_profiles_normalize_custom_id
  before insert or update on public.profiles
  for each row
  execute procedure public.normalize_profile_custom_id();

alter table public.profiles
  drop constraint if exists profiles_custom_id_format_check;
alter table public.profiles
  add constraint profiles_custom_id_format_check
  check (
    custom_id is null
    or custom_id ~ '^[a-z][a-z0-9_-]{2,29}$'
  );

alter table public.profiles
  drop constraint if exists profiles_custom_id_reserved_check;
alter table public.profiles
  add constraint profiles_custom_id_reserved_check
  check (
    custom_id is null
    or custom_id not in (
      'admin', 'api', 'app', 'auth', 'chat', 'create-skill', 'guide', 'inquiry',
      'legal', 'login', 'maintenance', 'mypage', 'profile', 'profile-setup',
      'signin', 'skills'
    )
  );

create unique index if not exists profiles_custom_id_unique_idx
  on public.profiles (lower(custom_id))
  where custom_id is not null;

create or replace function public.enforce_profile_custom_id_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.custom_id is not null
     and new.custom_id is distinct from old.custom_id then
    raise exception 'custom_id cannot be changed once set';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_custom_id_immutable on public.profiles;
create trigger trg_profiles_custom_id_immutable
  before update on public.profiles
  for each row
  execute procedure public.enforce_profile_custom_id_immutable();
