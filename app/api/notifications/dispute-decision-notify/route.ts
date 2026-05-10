import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl } from "@/lib/site-seo"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function isAdminUser(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
  return (data as { is_admin?: boolean | null } | null)?.is_admin === true
}

type Body = {
  transactionId?: string
  result?: "approved" | "rejected"
  adminReason?: string
  /** 棄却時は Server Action 側で既に dispute_result メールを送っている場合 true */
  skipEmail?: boolean
}

/**
 * 異議申し立ての承認・棄却後: 購入者・出品者の双方へアプリ内通知（および任意でメール）。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const adminOk = await isAdminUser(supabaseAdmin, auth.context.user.id)
    if (!adminOk) {
      return Response.json({ error: "forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const transactionId = String(body.transactionId ?? "").trim()
    const result = body.result
    const adminReason = String(body.adminReason ?? "").trim()
    const skipEmail = body.skipEmail === true

    if (!transactionId || (result !== "approved" && result !== "rejected")) {
      return Response.json({ error: "invalid payload" }, { status: 400 })
    }
    if (!adminReason) {
      return Response.json({ error: "adminReason is required" }, { status: 400 })
    }

    const { data: txRow, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id, buyer_id, seller_id, status, dispute_status")
      .eq("id", transactionId)
      .maybeSingle()

    if (txErr || !txRow) {
      return Response.json({ error: "transaction not found" }, { status: 404 })
    }

    const tx = txRow as {
      buyer_id?: string | null
      seller_id?: string | null
      status?: string | null
      dispute_status?: string | null
    }

    const buyerId = String(tx.buyer_id ?? "").trim()
    const sellerId = String(tx.seller_id ?? "").trim()
    if (!buyerId || !sellerId) {
      return Response.json({ error: "invalid transaction" }, { status: 400 })
    }

    if (result === "approved") {
      if (tx.status !== "active" || tx.dispute_status !== "resolved") {
        return Response.json(
          { error: "transaction must be active with resolved dispute for approval notify" },
          { status: 400 },
        )
      }
    } else {
      if (tx.status !== "completed" || tx.dispute_status !== "rejected") {
        return Response.json(
          { error: "transaction must be completed with rejected dispute for rejection notify" },
          { status: 400 },
        )
      }
    }

    const adminId = auth.context.user.id
    const appUrl = getAppBaseUrl()
    const chatUrl = `${appUrl}/chat/${encodeURIComponent(transactionId)}`

    if (!skipEmail) {
      const subject =
        result === "approved"
          ? "【GritVib】異議申し立てが承認されました"
          : "【GritVib】異議申し立てが棄却されました"
      const intro =
        result === "approved"
          ? "異議申し立てが承認され、取引は再開されました。"
          : "異議申し立ては棄却され、取引は完了しました。"
      await Promise.all([
        sendUserEventEmail({
          topic: "dispute_result",
          userId: buyerId,
          subject,
          heading: "異議申し立て結果通知",
          intro,
          ctaLabel: "取引チャットを確認",
          ctaUrl: chatUrl,
        }),
        sendUserEventEmail({
          topic: "dispute_result",
          userId: sellerId,
          subject,
          heading: "異議申し立て結果通知",
          intro,
          ctaLabel: "取引チャットを確認",
          ctaUrl: chatUrl,
        }),
      ])
    }

    const titleApprove = "異議申し立て承認"
    const titleReject = "異議申し立て棄却"

    if (result === "approved") {
      const { error: insErr } = await supabaseAdmin.from("notifications").insert([
        {
          recipient_id: sellerId,
          sender_id: adminId,
          type: "announcement",
          title: titleApprove,
          reason: adminReason,
          content:
            "購入者より不足の連絡があり、異議申し立てが承認されました。現在取引が再開されていますので、不足分の対応をお願いします",
          is_admin_origin: true,
          is_read: false,
        },
        {
          recipient_id: buyerId,
          sender_id: adminId,
          type: "announcement",
          title: titleApprove,
          reason: adminReason,
          content: "異議申し立てが認められました。取引を再開しますので、出品者と交渉を続けてください",
          is_admin_origin: true,
          is_read: false,
        },
      ])
      if (insErr) {
        console.error("[dispute-decision-notify] insert approved", insErr)
        return Response.json({ ok: false, error: "in_app_notify_failed" }, { status: 500 })
      }
    } else {
      const rejectContent = `運営対応: 異議申し立てを棄却し、取引を完了扱いにしました。理由: ${adminReason}`
      const completionContent = "異議申し立ての棄却により、取引が完了しました。"
      const txReason = `transaction_id:${transactionId}`
      const { error: insErr } = await supabaseAdmin.from("notifications").insert([
        {
          recipient_id: sellerId,
          sender_id: adminId,
          type: "admin_dispute_result",
          title: titleReject,
          reason: adminReason,
          content: rejectContent,
          is_admin_origin: true,
          is_read: false,
        },
        {
          recipient_id: buyerId,
          sender_id: adminId,
          type: "admin_dispute_result",
          title: titleReject,
          reason: adminReason,
          content: rejectContent,
          is_admin_origin: true,
          is_read: false,
        },
        {
          recipient_id: sellerId,
          sender_id: adminId,
          type: "completion_approved",
          title: null,
          reason: txReason,
          content: completionContent,
          is_admin_origin: false,
          is_read: false,
        },
        {
          recipient_id: buyerId,
          sender_id: adminId,
          type: "completion_approved",
          title: null,
          reason: txReason,
          content: completionContent,
          is_admin_origin: false,
          is_read: false,
        },
      ])
      if (insErr) {
        console.error("[dispute-decision-notify] insert rejected", insErr)
        return Response.json({ ok: false, error: "in_app_notify_failed" }, { status: 500 })
      }
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error("[dispute-decision-notify]", e)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
