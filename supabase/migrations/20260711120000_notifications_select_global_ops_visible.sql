-- 全体お知らせは recipient_id IS NULL・is_global = true の 1 行。
-- SELECT が「自分宛てのみ」のままだと一般ユーザーはその行を読めず「運営より」に出ない。
-- recipient_id IS NULL を広く許すと漏えいしやすいので、運営の全体お知らせに限定する。

alter table public.notifications
  add column if not exists is_global boolean not null default false;

drop policy if exists "notifications_select_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    or (
      recipient_id is null
      and coalesce(is_global, false) = true
      and type = 'announcement'
      and coalesce(is_admin_origin, false) = true
    )
  );
