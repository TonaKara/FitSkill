import { requireApiUser } from "@/lib/api-auth"
import { notifyNewUserRegistrationDiscord } from "@/lib/new-user-registration-discord"
import { getSiteUrl } from "@/lib/site-seo"

type Payload = {
  userId?: string
  email?: string
  displayName?: string
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const origin = req.headers.get("origin")?.trim()
    const siteOrigin = new URL(getSiteUrl()).origin
    if (origin && origin !== siteOrigin) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const userId = String(body.userId ?? "").trim()
    const email = String(body.email ?? "").trim()
    const displayName = String(body.displayName ?? "").trim()
    if (!userId) {
      return Response.json({ ok: false, error: "userId is required" }, { status: 400 })
    }
    if (auth.context.user.id !== userId) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const result = await notifyNewUserRegistrationDiscord({
      user: auth.context.user,
      email: email || auth.context.user.email,
      displayName,
    })
    if (!result.sent) {
      return Response.json({ ok: true, skipped: result.skipped })
    }

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: "Failed to send notification" }, { status: 500 })
  }
}
