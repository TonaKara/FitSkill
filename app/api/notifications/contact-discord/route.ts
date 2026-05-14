import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

type Payload = {
  name?: string
  email?: string
  category?: string
  subject?: string
  /** ログイン中の送信時のみ。未ログインは空または省略。 */
  submitter_profile_id?: string | null
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
    const origin = req.headers.get("origin")?.trim()
    const siteOrigin = new URL(getSiteUrl()).origin
    if (!origin || origin !== siteOrigin) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const webhookUrl = resolveContactDiscordWebhookUrl()
    if (!webhookUrl) {
      return Response.json({ ok: true, skipped: "missing webhook" })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const name = String(body.name ?? "").trim() || "未入力"
    const email = String(body.email ?? "").trim() || "未入力"
    const category = String(body.category ?? "").trim() || "未入力"
    const subject = String(body.subject ?? "").trim() || "（件名なし）"
    const submitterProfileId = String(body.submitter_profile_id ?? "").trim()
    const baseUrl = getSiteUrl().replace(/\/$/, "")
    const adminContactsUrl = `${baseUrl}/admin/contacts`
    const senderLines =
      submitterProfileId.length > 0
        ? [
            `- 送信者 profiles.id: ${submitterProfileId}`,
            `- 公開プロフィール: ${baseUrl}/profile/${encodeURIComponent(submitterProfileId)}`,
          ]
        : ["- 送信者 profiles.id: （未ログインの送信）"]

    await sendDiscordNotification(
      webhookUrl,
      [
        "@everyone",
        "📩 **お問い合わせ送信**",
        `- 名前: ${name}`,
        `- メール: ${email}`,
        `- カテゴリ: ${category}`,
        `- 件名: ${subject}`,
        ...senderLines,
        `- 管理画面: ${adminContactsUrl}`,
      ].join("\n"),
    )

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: "Failed to send notification" }, { status: 500 })
  }
}
