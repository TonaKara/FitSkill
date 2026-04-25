"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { computeSellerFeePreview } from "@/lib/seller-fee-preview"

type AdminProfileRow = {
  is_admin: boolean | null
}

type TransactionRow = {
  id: string
  seller_id: string
  buyer_id: string
  price: number
  status: string
}

type SellerStripeRow = {
  stripe_connect_account_id: string | null
}

export type CompleteTransactionWithPayoutMode = "standard" | "dispute_rejection"

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function getAuthedSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return { supabase, user }
}

async function notifyAllAdminsPayoutFailure(
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>,
  transactionId: string,
  content: string,
) {
  const { data: admins, error: adminListError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)

  if (adminListError) {
    console.error("[payout] failed to list admins for failure notification", adminListError)
    return
  }

  const adminIds = (admins ?? [])
    .map((r) => (r as { id?: string }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  for (const recipientId of adminIds) {
    const { error } = await supabaseAdmin.from("notifications").insert({
      recipient_id: recipientId,
      sender_id: null,
      type: "admin_payout_failed",
      title: "送金に失敗しました",
      reason: `transaction_id:${transactionId}`,
      content,
      is_admin_origin: true,
      is_read: false,
    })
    if (error) {
      console.error("[payout] failed to notify admin", { recipientId, error })
    }
  }
}

/**
 * 送金（Stripe Transfers）成功後にのみ取引を `completed` に更新する。
 * 異議棄却（取引完了）は `dispute_rejection` を指定する。
 */
export async function completeTransactionWithPayout(
  transactionId: string,
  mode: CompleteTransactionWithPayoutMode = "standard",
) {
  if (!transactionId?.trim()) {
    throw new Error("transactionId is required")
  }

  const { supabase, user } = await getAuthedSupabase()
  const { data: adminProfile, error: adminError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<AdminProfileRow>()

  if (adminError || !adminProfile?.is_admin) {
    throw new Error("Admin permission required")
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const stripe = getStripeClient()

  const { data: tx, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, seller_id, buyer_id, price, status")
    .eq("id", transactionId)
    .maybeSingle<TransactionRow>()

  if (txError || !tx) {
    throw new Error(txError?.message ?? "Transaction not found")
  }

  if (tx.status === "completed") {
    return { success: true as const, transactionId: tx.id, alreadyCompleted: true as const }
  }

  if (mode === "standard" && tx.status === "disputed") {
    throw new Error("異議申立て中の取引は管理画面の「棄却（取引完了）」から完了してください。")
  }
  if (mode === "dispute_rejection" && tx.status !== "disputed") {
    throw new Error("この取引は異議申立て中ではありません。")
  }

  const { data: sellerProfile, error: sellerError } = await supabaseAdmin
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", tx.seller_id)
    .maybeSingle<SellerStripeRow>()

  if (sellerError || !sellerProfile?.stripe_connect_account_id) {
    throw new Error(sellerError?.message ?? "Seller Stripe account is not configured")
  }

  const connectId = sellerProfile.stripe_connect_account_id.trim()
  if (!connectId) {
    throw new Error("Seller Stripe account is not configured")
  }

  const gross = Math.max(0, Math.round(Number(tx.price)))
  if (gross < 1) {
    throw new Error("Invalid transaction price")
  }

  const feePreview = computeSellerFeePreview(gross)
  if (!feePreview || feePreview.receiveYen < 1) {
    throw new Error("Payout amount is too small")
  }

  const payoutAmount = feePreview.receiveYen
  const feeYen = feePreview.feeYen

  const nowIso = new Date().toISOString()

  let transferId: string
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: payoutAmount,
        currency: "jpy",
        destination: connectId,
        metadata: {
          transaction_id: tx.id,
          buyer_id: tx.buyer_id,
          seller_id: tx.seller_id,
          gross_amount: String(gross),
          fee_amount: String(feeYen),
        },
      },
      { idempotencyKey: `payout-transfer-${tx.id}` },
    )
    transferId = transfer.id
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await notifyAllAdminsPayoutFailure(
      supabaseAdmin,
      tx.id,
      `取引送金（Stripe）に失敗しました: ${message}`,
    )
    throw new Error(`Payout failed: ${message}`)
  }

  if (mode === "dispute_rejection") {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        dispute_status: "rejected",
        completed_at: nowIso,
        auto_complete_at: null,
      })
      .eq("id", tx.id)
      .eq("status", "disputed")
      .select("id")

    if (updateError) {
      await notifyAllAdminsPayoutFailure(
        supabaseAdmin,
        tx.id,
        `送金は成功しました（transfer: ${transferId}）が、取引のDB更新に失敗しました: ${updateError.message}`,
      )
      throw new Error(`Database update failed after transfer: ${updateError.message}`)
    }
    if (!updated?.length) {
      await notifyAllAdminsPayoutFailure(
        supabaseAdmin,
        tx.id,
        `送金は成功しました（transfer: ${transferId}）が、取引ステータスが異議中ではないためDBを更新できませんでした。手作業で整合性を確認してください。`,
      )
      throw new Error("Transaction was not in disputed status; payout may require manual review.")
    }
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        completed_at: nowIso,
      })
      .eq("id", tx.id)
      .neq("status", "completed")

    if (updateError) {
      await notifyAllAdminsPayoutFailure(
        supabaseAdmin,
        tx.id,
        `送金は成功しました（transfer: ${transferId}）が、取引のDB更新に失敗しました: ${updateError.message}`,
      )
      throw new Error(`Database update failed after transfer: ${updateError.message}`)
    }
  }

  return {
    success: true as const,
    transactionId: tx.id,
    transferId,
    grossAmount: gross,
    feeAmount: feeYen,
    payoutAmount,
  }
}
