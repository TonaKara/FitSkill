create table if not exists public.cms_settings (
  id integer primary key,
  site_name text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  price_info text not null default '',
  payment_method text not null default '',
  delivery_info text not null default '',
  return_policy text not null default '',
  refund_policy text not null default '',
  service_terms text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_settings_singleton_id check (id = 1)
);

alter table public.cms_settings enable row level security;

drop policy if exists "cms_settings_select_all" on public.cms_settings;
create policy "cms_settings_select_all"
  on public.cms_settings
  for select
  using (true);

drop policy if exists "cms_settings_insert_admin" on public.cms_settings;
create policy "cms_settings_insert_admin"
  on public.cms_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "cms_settings_update_admin" on public.cms_settings;
create policy "cms_settings_update_admin"
  on public.cms_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

insert into public.cms_settings (id)
values (1)
on conflict (id) do nothing;
