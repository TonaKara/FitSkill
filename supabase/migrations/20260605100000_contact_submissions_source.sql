-- GritVib 管理画面で問い合わせを識別するための source 列。
alter table if exists public.contact_submissions
  add column if not exists source text;

comment on column public.contact_submissions.source is
  '問い合わせの送信元。GritVib は gritvib。NULL は旧データまたは他サービス。';

create index if not exists contact_submissions_source_created_idx
  on public.contact_submissions (source, created_at desc)
  where source = 'gritvib';

-- 既存の GritVib フォーム分をバックフィル
update public.contact_submissions
   set source = 'gritvib'
 where source is null
   and subject = 'GritVib お問い合わせ';
