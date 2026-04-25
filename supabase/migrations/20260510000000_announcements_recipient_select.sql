-- 受信者が自分宛・全体向けのお知らせ行を参照できるようにする（通知一覧と件名マッチ用）
drop policy if exists "announcements_recipient_select" on public.announcements;
create policy "announcements_recipient_select"
  on public.announcements for select
  to authenticated
  using (
    target_user_id is null
    or target_user_id = (select auth.uid())
  );
