import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

type Payload = {
  name?: string
  email?: string
  category?: string
  subject?: string
}

/** 運用では `DISCORD_WEBHOOK_INQUIRY`。旧名 `DISCORD_WEBHOOK_CONTACT` は互換用 */
function resolveContactDiscordWebhookUrl(): string {
  const candidates = [process.env.DISCORD_WEBHOOK_INQUIRY, process.env.DISCORD_WEBHOOK_CONTACT]
  for (const raw of candidates) {
    const t = raw?.trim()
    if (t) {
      return t
    }
  }
  return ""
}

export async function POST(req: Request) {
  try {
    const webhookUrl = resolveContactDiscordWebhookUrl()
    if (!webhookUrl) {
      return Response.json({ ok: true, skipped: "missing webhook" })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const name = String(body.name ?? "").trim() || "未入力"
    const email = String(body.email ?? "").trim() || "未入力"
    const category = String(body.category ?? "").trim() || "未入力"
    const subject = String(body.subject ?? "").trim() || "（件名なし）"
    const baseUrl = getSiteUrl().replace(/\/$/, "")
    const adminContactsUrl = `${baseUrl}/admin/contacts`

    await sendDiscordNotification(
      webhookUrl,
      [
        "@everyone",
        "📩 **お問い合わせ送信**",
        `- 名前: ${name}`,
        `- メール: ${email}`,
        `- カテゴリ: ${category}`,
        `- 件名: ${subject}`,
        `- 管理画面: ${adminContactsUrl}`,
      ].join("\n"),
    )

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
