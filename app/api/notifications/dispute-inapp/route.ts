import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"

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
}

const DISPUTE_NOTIFICATION_TYPE = "dispute"

/**
 * 異議申し立て成立後、講師・生徒の双方にアプリ内通知を作成する。
 * クライアントの RLS では「自分宛て」行を申立人が作れないため service role で挿入する。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await req.json().catch(() => ({}))) as Payload
    const transactionId = String(body.transactionId ?? "").trim()
    if (!transactionId) {
      return Response.json({ ok: false, error: "transactionId is required" }, { status: 400 })
    }

    const requesterId = auth.context.user.id
    const supabase = getSupabaseAdminClient()

    const { data: txRow, error: txErr } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, status")
      .eq("id", transactionId)
      .maybeSingle()

    if (txErr || !txRow) {
      return Response.json({ ok: false, error: "transaction not found" }, { status: 404 })
    }

    const tx = txRow as {
      buyer_id?: string | null
      seller_id?: string | null
      status?: string | null
    }

    const buyerId = String(tx.buyer_id ?? "").trim()
    const sellerId = String(tx.seller_id ?? "").trim()

    if (!buyerId || !sellerId) {
      return Response.json({ ok: false, error: "invalid transaction parties" }, { status: 400 })
    }

    if (requesterId !== buyerId) {
      return Response.json({ ok: false, error: "forbidden" }, { status: 403 })
    }

    if (tx.status !== "disputed") {
      return Response.json({ ok: false, error: "transaction is not disputed" }, { status: 400 })
    }

    const reason = `transaction_id:${transactionId}`

    const { error: insErr } = await supabase.from("notifications").insert([
      {
        recipient_id: sellerId,
        sender_id: buyerId,
        type: DISPUTE_NOTIFICATION_TYPE,
        content: "取引に異議申し立てがありました。運営の確認をお待ちください。",
        reason,
        title: null,
        is_admin_origin: false,
        is_read: false,
      },
      {
        recipient_id: buyerId,
        sender_id: sellerId,
        type: DISPUTE_NOTIFICATION_TYPE,
        content: "異議申し立てを送信しました。運営の確認をお待ちください。",
        reason,
        title: null,
        is_admin_origin: false,
        is_read: false,
      },
    ])

    if (insErr) {
      console.error("[dispute-inapp] notifications insert failed", insErr)
      return Response.json({ ok: false, error: "failed to create notifications" }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error("[dispute-inapp]", e)
    return Response.json({ ok: false, error: "internal error" }, { status: 500 })
  }
}
