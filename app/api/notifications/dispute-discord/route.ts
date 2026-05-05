import { createClient } from "@supabase/supabase-js"
import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

type Payload = {
  transactionId?: string
  reason?: string
}

export async function POST(req: Request) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_DISPUTE?.trim() ?? ""
    if (!webhookUrl) {
      return Response.json({ ok: true, skipped: "missing webhook" })
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const transactionId = String(body.transactionId ?? "").trim()
    if (!transactionId) {
      return Response.json({ ok: false, error: "transactionId is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: txRow } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, skill_id, disputed_reason")
      .eq("id", transactionId)
      .maybeSingle()

    const tx = txRow as {
      id?: string | number
      buyer_id?: string | null
      seller_id?: string | null
      skill_id?: string | number | null
      disputed_reason?: string | null
    } | null

    const buyerId = String(tx?.buyer_id ?? "").trim()
    const sellerId = String(tx?.seller_id ?? "").trim()
    const skillId = String(tx?.skill_id ?? "").trim()
    const reason = String(body.reason ?? tx?.disputed_reason ?? "").trim() || "未入力"

    const [{ data: skillRow }, { data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      skillId ? supabase.from("skills").select("title").eq("id", skillId).maybeSingle() : Promise.resolve({ data: null }),
      buyerId ? supabase.from("profiles").select("display_name").eq("id", buyerId).maybeSingle() : Promise.resolve({ data: null }),
      sellerId ? supabase.from("profiles").select("display_name").eq("id", sellerId).maybeSingle() : Promise.resolve({ data: null }),
    ])

    const skillTitle = ((skillRow as { title?: string | null } | null)?.title ?? "").trim() || skillId || "不明"
    const buyerName =
      ((buyerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || buyerId || "不明"
    const sellerName =
      ((sellerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || sellerId || "不明"

    const baseUrl = getSiteUrl().replace(/\/$/, "")
    await sendDiscordNotification(
      webhookUrl,
      [
        "@everyone",
        "⚠️ **異議申し立てが送信されました**",
        `- 取引ID: ${transactionId}`,
        `- 商品: ${skillTitle}`,
        `- 購入者: ${buyerName}`,
        `- 講師: ${sellerName}`,
        `- 理由: ${reason}`,
        `- 取引チャット: ${baseUrl}/chat/${encodeURIComponent(transactionId)}`,
        `- 管理画面: ${baseUrl}/admin/disputes`,
      ].join("\n"),
    )

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
