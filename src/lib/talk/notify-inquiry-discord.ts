import "server-only"

import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

export type GritvibInquiryDiscordPayload = {
  name: string
  email: string
  category: string
  subject: string
  submitterProfileId?: string | null
  inquiryId?: number | null
}

function resolveInquiryDiscordWebhookUrl(): string {
  const candidates = [process.env.DISCORD_WEBHOOK_INQUIRY, process.env.DISCORD_WEBHOOK_CONTACT]
  for (const raw of candidates) {
    const t = raw?.trim()
    if (t) return t
  }
  return ""
}

/**
 * GritVib 問い合わせ受付時の Discord 通知 (best-effort)。
 * Webhook 未設定時は何もしない。
 */
export async function notifyGritvibInquiryDiscord(
  payload: GritvibInquiryDiscordPayload,
): Promise<void> {
  const webhookUrl = resolveInquiryDiscordWebhookUrl()
  if (!webhookUrl) return

  const name = payload.name.trim() || "未入力"
  const email = payload.email.trim() || "未入力"
  const category = payload.category.trim() || "未入力"
  const subject = payload.subject.trim() || "（件名なし）"
  const submitterProfileId = (payload.submitterProfileId ?? "").trim()
  const baseUrl = getSiteUrl().replace(/\/$/, "")
  const adminUrl = `${baseUrl}/talk/admin?view=inquiries`
  const senderLines =
    submitterProfileId.length > 0
      ? [`- 送信者 profiles.id: ${submitterProfileId}`]
      : ["- 送信者 profiles.id: （未ログインの送信）"]
  const idLine =
    typeof payload.inquiryId === "number" && payload.inquiryId > 0
      ? [`- 問い合わせ ID: ${payload.inquiryId}`]
      : []

  await sendDiscordNotification(
    webhookUrl,
    [
      "@everyone",
      "📩 **GritVib お問い合わせ**",
      ...idLine,
      `- 名前: ${name}`,
      `- メール: ${email}`,
      `- カテゴリ: ${category}`,
      `- 件名: ${subject}`,
      ...senderLines,
      `- 管理画面: ${adminUrl}`,
    ].join("\n"),
  )
}
