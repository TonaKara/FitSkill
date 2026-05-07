import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

type Payload = {
  userId?: string
  email?: string
  displayName?: string
}

/** 運用では `DISCORD_WEBHOOK_USER_REGISTRATION`。旧名 `DISCORD_WEBHOOK_NEW_USER` は互換用 */
function resolveNewUserDiscordWebhookUrl(): string {
  const candidates = [process.env.DISCORD_WEBHOOK_USER_REGISTRATION, process.env.DISCORD_WEBHOOK_NEW_USER]
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
    if (origin && origin !== siteOrigin) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const webhookUrl = resolveNewUserDiscordWebhookUrl()
    if (!webhookUrl) {
      return Response.json({ ok: true, skipped: "missing webhook" })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const userId = String(body.userId ?? "").trim()
    const email = String(body.email ?? "").trim()
    const displayName = String(body.displayName ?? "").trim()
    if (!userId) {
      return Response.json({ ok: false, error: "userId is required" }, { status: 400 })
    }

    const baseUrl = getSiteUrl().replace(/\/$/, "")
    const adminUsersUrl = `${baseUrl}/admin/users`
    await sendDiscordNotification(
      webhookUrl,
      [
        "🆕 **新規ユーザー登録**",
        `- ユーザーID: ${userId}`,
        displayName ? `- 表示名: ${displayName}` : null,
        email ? `- メール: ${email}` : null,
        `- 管理画面: ${adminUsersUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: "Failed to send notification" }, { status: 500 })
  }
}
