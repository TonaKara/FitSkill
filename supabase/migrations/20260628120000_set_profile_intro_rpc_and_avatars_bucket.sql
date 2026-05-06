-- プロフィールの自己紹介等を RPC で確実に更新（PostgREST の upsert 周りの差異を避ける）
-- 公開読み取り・本人のみ avatars バケットにアップロード可能

create or replace function public.set_profile_intro_fields(
  target_user_id uuid,
  new_bio text,
  new_fitness_history text,
  new_category text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    bio = new_bio,
    fitness_history = new_fitness_history,
    category = coalesce(new_category, array[]::text[])
  where id = target_user_id;
end;
$$;

comment on function public.set_profile_intro_fields(uuid, text, text, text[]) is
  'プロフィール設定の bio / fitness_history / category を更新（サービスロールの API から呼ぶ想定）';

revoke all on function public.set_profile_intro_fields(uuid, text, text, text[]) from public;
grant execute on function public.set_profile_intro_fields(uuid, text, text, text[]) to service_role;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );
