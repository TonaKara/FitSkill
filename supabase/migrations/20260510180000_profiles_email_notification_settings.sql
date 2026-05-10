-- メール通知のマスター／項目別オンオフ（JSON で保持）

alter table public.profiles
  add column if not exists email_notification_settings jsonb not null default '{
    "master": true,
    "consultation_offer": true,
    "consultation_decision": true,
    "transaction_chat": true,
    "transaction_established": true,
    "completion_request": true,
    "transaction_completed": true,
    "dispute_result": true,
    "account_notice": true,
    "inquiry_chat": true
  }'::jsonb;

comment on column public.profiles.email_notification_settings is
  'Resend メール通知のみ。既定すべてオン。master false で全メール停止。アプリ内 notifications は別経路で常に作成。キーは src/lib/email-notification-settings.ts と対応。';
