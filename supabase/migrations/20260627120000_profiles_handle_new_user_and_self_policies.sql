-- 新規サインアップ時に profiles 行を確実に作成し、本人による insert/update を許可する。
-- （プロフィール設定画面の update が 0 件になる・RLS で insert できない問題の対策）

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text;
begin
  v_display := coalesce(
    nullif(trim(both from coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(both from coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
  if v_display = '' or v_display is null then
    v_display := 'ユーザー';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
