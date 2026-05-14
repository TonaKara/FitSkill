import { createClient } from "@supabase/supabase-js"

import { requireApiUser } from "@/lib/api-auth"
import { insertTransactionCompletedInAppNotifications } from "@/lib/transaction-completed-inapp"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

type Body = {
  transactionId?: string
}

/**
 * クライアント側の一括自動完了（`autoCompleteTransactions`）後など、
 * 取引が `completed` になった直後に双方へアプリ内通知を付与する。
 * メールは `event-email` のまま。ここはアプリ内のみ。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }
    const supabaseAdmin = getSupabaseAdminClient()
    if (!supabaseAdmin) {
      return Response.json({ ok: false, skipped: "admin_not_configured" }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const transactionId = String(body.transactionId ?? "").trim()
    if (!transactionId) {
      return Response.json({ error: "transactionId is required" }, { status: 400 })
    }

    const { data, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id, buyer_id, seller_id, status")
      .eq("id", transactionId)
      .maybeSingle()

    const tx = data as { id?: string; buyer_id?: string; seller_id?: string; status?: string } | null
    if (txErr || !tx?.id || !tx.buyer_id || !tx.seller_id) {
      return Response.json({ error: "transaction not found" }, { status: 404 })
    }
    if (tx.status !== "completed") {
      return Response.json({ error: "transaction is not completed" }, { status: 400 })
    }

    const uid = auth.context.user.id
    if (uid !== tx.buyer_id && uid !== tx.seller_id) {
      return Response.json({ error: "forbidden" }, { status: 403 })
    }

    const { error: inAppErr } = await insertTransactionCompletedInAppNotifications(
      supabaseAdmin,
      { id: tx.id, buyer_id: tx.buyer_id, seller_id: tx.seller_id },
      "timeout",
    )
    if (inAppErr) {
      console.error("[transaction-completed-inapp] insert failed", inAppErr)
      return Response.json({ error: "in_app_notify_failed" }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error("[transaction-completed-inapp]", e)
    return Response.json({ error: "internal" }, { status: 500 })
  }
}
