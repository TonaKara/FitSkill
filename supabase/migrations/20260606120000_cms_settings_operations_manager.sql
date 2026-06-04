-- 特定商取引法表記: 運営責任者
alter table public.cms_settings
  add column if not exists operations_manager text not null default '';

comment on column public.cms_settings.operations_manager is
  '特定商取引法に基づく表記の「運営責任者」。';
