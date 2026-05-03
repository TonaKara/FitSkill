-- 事前相談チャット用フラグ（事前オファー is_enabled とは独立）

alter table public.consultation_settings
  add column if not exists is_chat_enabled boolean not null default false;

-- これまで is_enabled のみでチャットも制御していたデータは、チャットもオンだった扱いにする
update public.consultation_settings
set is_chat_enabled = true
where is_enabled = true
  and is_chat_enabled = false;
