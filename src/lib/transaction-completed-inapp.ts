import type { SupabaseClient } from "@supabase/supabase-js"

import { NOTIFICATION_TYPE } from "@/lib/transaction-notifications"

export type TransactionCompletedNoticeKind = "buyer_approved" | "timeout"

function completionMessages(kind: TransactionCompletedNoticeKind): { seller: string; buyer: string } {
  if (kind === "buyer_approved") {
    return {
      seller: "取引が買主により承認され、完了しました。",
      buyer: "取引が完了しました。講師への支払いが確定しました。",
    }
  }
  return {
    seller: "取引が完了しました（承認期限の経過により自動完了となりました）。",
    buyer: "取引が完了しました（承認期限の経過により自動完了となりました）。講師への支払いが確定しました。",
  }
}

/**
 * 取引完了時の双方へのアプリ内通知（service role クライアントで挿入する想定）。
 */
export async function insertTransactionCompletedInAppNotifications(
  supabaseAdmin: SupabaseClient,
  tx: { id: string; buyer_id: string; seller_id: string },
  kind: TransactionCompletedNoticeKind,
): Promise<{ error: { message: string } | null }> {
  const { seller, buyer } = completionMessages(kind)
  const reason = `transaction_id:${tx.id}`
  const { error } = await supabaseAdmin.from("notifications").insert([
    {
      recipient_id: tx.seller_id,
      sender_id: tx.buyer_id,
      type: NOTIFICATION_TYPE.completion_approved,
      title: null,
      reason,
      content: seller,
      is_admin_origin: false,
      is_read: false,
    },
    {
      recipient_id: tx.buyer_id,
      sender_id: tx.seller_id,
      type: NOTIFICATION_TYPE.completion_approved,
      title: null,
      reason,
      content: buyer,
      is_admin_origin: false,
      is_read: false,
    },
  ])
  if (error) {
    console.error("[insertTransactionCompletedInAppNotifications] insert failed", {
      message: error.message,
      code: (error as { code?: string }).code ?? null,
      transactionId: tx.id,
      kind,
    })
    return { error: { message: error.message } }
  }
  return { error: null }
}
