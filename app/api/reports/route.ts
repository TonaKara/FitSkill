import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { getSiteUrl } from "@/lib/site-seo"

type ReportType = "user" | "product"

type Payload = {
  type?: ReportType
  targetId?: string | number
  reason?: string
  content?: string
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function truncateForEmbed(text: string, limit: number): string {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1))}…`
}

async function sendReportDiscordNotification(params: {
  webhookUrl: string
  reportType: ReportType
  targetName: string
  targetUrl: string
  reason: string
  detailMessage: string
  reporterName: string
  reporterId: string
}) {
  const {
    webhookUrl,
    reportType,
    targetName,
    targetUrl,
    reason,
    detailMessage,
    reporterName,
    reporterId,
  } = params

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `🚨 通報通知 (${reportType === "user" ? "ユーザー" : "スキル"})`,
          color: 0xed4245,
          fields: [
            {
              name: "対象",
              value: `[${truncateForEmbed(targetName, 200)}](${targetUrl})`,
            },
            {
              name: "通報理由",
              value: truncateForEmbed(reason, 1024),
              inline: false,
            },
            {
              name: "詳細メッセージ",
              value: truncateForEmbed(detailMessage, 1024),
              inline: false,
            },
            {
              name: "通報者情報",
              value: `${truncateForEmbed(reporterName, 200)} (${reporterId})`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText} ${body}`)
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const reportType = body.type === "user" || body.type === "product" ? body.type : null
    if (!reportType) {
      return Response.json({ ok: false, error: "type is required" }, { status: 400 })
    }

    const reason = String(body.reason ?? "").trim()
    const detailMessage = String(body.content ?? "").trim()
    if (!reason || !detailMessage) {
      return Response.json({ ok: false, error: "reason and content are required" }, { status: 400 })
    }

    const reporterId = auth.context.user.id
    const supabase = getSupabaseAdminClient()
    const siteUrl = getSiteUrl().replace(/\/$/, "")
    const nowIso = new Date().toISOString()

    let targetName = ""
    let targetUrl = ""

    if (reportType === "user") {
      const reportedUserId = String(body.targetId ?? "").trim()
      if (!reportedUserId) {
        return Response.json({ ok: false, error: "targetId is required" }, { status: 400 })
      }

      const { error: insertError } = await supabase.from("user_reports").insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        content: detailMessage,
        status: "pending",
        created_at: nowIso,
      })
      if (insertError) {
        return Response.json({ ok: false, error: insertError.message }, { status: 500 })
      }

      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", reportedUserId)
        .maybeSingle<{ display_name: string | null }>()
      targetName = (targetProfile?.display_name ?? "").trim() || `ユーザーID: ${reportedUserId}`
      targetUrl = `${siteUrl}/profile/${encodeURIComponent(reportedUserId)}`
    } else {
      const productId = Number(body.targetId)
      if (!Number.isFinite(productId)) {
        return Response.json({ ok: false, error: "targetId must be a valid product id" }, { status: 400 })
      }

      const { error: insertError } = await supabase.from("product_reports").insert({
        reporter_id: reporterId,
        product_id: productId,
        reason,
        content: detailMessage,
        status: "pending",
        created_at: nowIso,
      })
      if (insertError) {
        return Response.json({ ok: false, error: insertError.message }, { status: 500 })
      }

      const { data: skillRow } = await supabase
        .from("skills")
        .select("id, title")
        .eq("id", String(productId))
        .maybeSingle<{ id: string | number; title: string | null }>()
      const skillId = String(skillRow?.id ?? productId)
      targetName = (skillRow?.title ?? "").trim() || `スキルID: ${skillId}`
      targetUrl = `${siteUrl}/skills/${encodeURIComponent(skillId)}`
    }

    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", reporterId)
      .maybeSingle<{ display_name: string | null }>()
    const reporterName = (reporterProfile?.display_name ?? "").trim() || "不明ユーザー"

    const webhookUrl = process.env.DISCORD_WEBHOOK_REPORT?.trim() ?? ""
    if (webhookUrl) {
      await sendReportDiscordNotification({
        webhookUrl,
        reportType,
        targetName,
        targetUrl,
        reason,
        detailMessage,
        reporterName,
        reporterId,
      })
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
