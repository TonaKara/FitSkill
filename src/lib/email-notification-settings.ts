/**
 * profiles.email_notification_settings と対応するキー。
 *
 * - 既定はすべてオン（新規ユーザー・カラム未設定時も {@link DEFAULT_EMAIL_NOTIFICATION_SETTINGS} と同じ）。
 * - オフのときは Resend 経由のメールだけ送らない。**アプリ内通知（`notifications` テーブル・通知ベル等）は参照しない。**
 * - master が false のときはメールを一切送らず、DB 上は項目値も false にそろえる。
 */

export const EMAIL_NOTIFICATION_TOPIC_KEYS = [
  "consultation_offer",
  "consultation_decision",
  "transaction_chat",
  "transaction_established",
  "completion_request",
  "transaction_completed",
  "checkout_refund",
  "dispute_result",
  "account_notice",
  "inquiry_chat",
] as const

export type EmailNotificationTopicKey = (typeof EMAIL_NOTIFICATION_TOPIC_KEYS)[number]

export type EmailNotificationSettings = {
  master: boolean
} & Record<EmailNotificationTopicKey, boolean>

export const DEFAULT_EMAIL_NOTIFICATION_SETTINGS: EmailNotificationSettings = {
  master: true,
  consultation_offer: true,
  consultation_decision: true,
  transaction_chat: true,
  transaction_established: true,
  completion_request: true,
  transaction_completed: true,
  checkout_refund: true,
  dispute_result: true,
  account_notice: true,
  inquiry_chat: true,
}

/** アカウント設定 UI 用ラベル（キー順） */
export const EMAIL_NOTIFICATION_TOPIC_ITEMS: {
  key: EmailNotificationTopicKey
  label: string
  hint?: string
}[] = [
  { key: "consultation_offer", label: "事前オファー（講師向け）", hint: "スキルへの新しい事前オファーが届いたとき" },
  { key: "consultation_decision", label: "事前オファーの結果（受講者向け）", hint: "講師が承認または拒否したとき" },
  { key: "transaction_chat", label: "取引チャットの新着メッセージ" },
  { key: "transaction_established", label: "取引の成立" },
  { key: "completion_request", label: "取引完了の申請", hint: "出品者から完了申請があったとき（受講者向け）" },
  { key: "transaction_completed", label: "取引の完了" },
  {
    key: "checkout_refund",
    label: "購入時の自動返金",
    hint: "申し込み枠の確保に失敗し、お支払いが自動返金されたとき",
  },
  { key: "dispute_result", label: "異議申し立ての審査結果" },
  {
    key: "account_notice",
    label: "運営からのアカウント・出品に関するお知らせ",
    hint: "利用停止や出品のモデレーションなど",
  },
  { key: "inquiry_chat", label: "相談チャットの新着メッセージ" },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** DB 値が null / 不正なときはすべてオンとして扱う */
export function parseEmailNotificationSettings(raw: unknown): EmailNotificationSettings {
  const base = { ...DEFAULT_EMAIL_NOTIFICATION_SETTINGS }
  if (!isRecord(raw)) {
    return base
  }
  const master = raw.master === false ? false : true
  const next = { ...base, master }
  for (const key of EMAIL_NOTIFICATION_TOPIC_KEYS) {
    next[key] = raw[key] === false ? false : true
  }
  if (!master) {
    for (const key of EMAIL_NOTIFICATION_TOPIC_KEYS) {
      next[key] = false
    }
  }
  return next
}

/** master をオフにするとき、項目もすべて false で保存する */
export function coerceEmailNotificationSettingsForSave(settings: EmailNotificationSettings): EmailNotificationSettings {
  if (!settings.master) {
    const off = { ...DEFAULT_EMAIL_NOTIFICATION_SETTINGS, master: false }
    for (const key of EMAIL_NOTIFICATION_TOPIC_KEYS) {
      off[key] = false
    }
    return off
  }
  return { ...settings }
}

/** Resend でメールを送ってよいか。アプリ内通知の作成とは無関係。 */
export function shouldSendEmailForTopic(
  settings: EmailNotificationSettings,
  topic: EmailNotificationTopicKey,
): boolean {
  if (!settings.master) {
    return false
  }
  return settings[topic] === true
}
