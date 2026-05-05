import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { sendDiscordNotification } from "@/lib/discord"

type Payload = {
  userId?: string
}

const IN_PROGRESS_TRANSACTION_STATUSES = ["progress", "in_progress", "active", "approval_pending", "disputed"] as const

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_BAN?.trim() ?? ""
    if (!webhookUrl) {
      return Response.json({ ok: true, skipped: "missing webhook" })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const userId = String(body.userId ?? "").trim()
    if (!userId) {
      return Response.json({ ok: false, error: "userId is required" }, { status: 400 })
    }
    if (!isUuidLike(userId)) {
      return Response.json({ ok: false, error: "invalid userId format" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { user } = auth.context
    const { data: adminRow, error: adminError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null }>()
    if (adminError || adminRow?.is_admin !== true) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }

    const [{ data: profileRow }, { count, error: countError }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in("status", [...IN_PROGRESS_TRANSACTION_STATUSES]),
    ])

    if (countError) {
      throw countError
    }

    const displayName =
      ((profileRow as { display_name?: string | null } | null)?.display_name ?? "").trim() || `ユーザーID: ${userId}`
    const progressCount = count ?? 0
    await sendDiscordNotification(
      webhookUrl,
      `ユーザー${displayName}をBANしました。現在 ${progressCount} 件の進行中の取引があります。確認してください。`,
    )

    return Response.json({ ok: true, progressCount })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
