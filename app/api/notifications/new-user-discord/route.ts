import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

type Payload = {
  userId?: string
  email?: string
  displayName?: string
}

export async function POST(req: Request) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_NEW_USER?.trim() ?? ""
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
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
