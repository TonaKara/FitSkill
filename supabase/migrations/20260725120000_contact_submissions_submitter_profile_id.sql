-- お問い合わせ: ログイン中に送信した場合は profiles.id（= auth.users.id）を記録する。未ログインは NULL。
-- クライアントの値は使わず、トリガーで上書きする（なりすまし防止）。

alter table if exists public.contact_submissions
  add column if not exists submitter_profile_id uuid references public.profiles (id) on delete set null;

comment on column public.contact_submissions.submitter_profile_id is
  '送信時にログインしていた場合の profiles.id。未ログイン時は NULL。';

create index if not exists contact_submissions_submitter_profile_id_idx
  on public.contact_submissions (submitter_profile_id)
  where submitter_profile_id is not null;

create or replace function public.contact_submissions_set_submitter_profile_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.submitter_profile_id := auth.uid();
  else
    new.submitter_profile_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contact_submissions_set_submitter_profile_id on public.contact_submissions;
create trigger trg_contact_submissions_set_submitter_profile_id
  before insert on public.contact_submissions
  for each row
  execute function public.contact_submissions_set_submitter_profile_id();
