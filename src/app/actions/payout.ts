"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl } from "@/lib/site-seo"

type AdminProfileRow = {
  is_admin: boolean | null
}

type TransactionRow = {
  id: string
  buyer_id: string
  seller_id: string
  status: string
}

export type CompleteTransactionWithPayoutMode = "standard" | "dispute_rejection"

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

  if (adminError) {
    throw new Error(adminError.message)
  }
  const isAdmin = adminProfile?.is_admin === true
  if (mode === "dispute_rejection" && !isAdmin) {
    throw new Error("Admin permission required")
  }

  const supabaseAdmin = getSupabaseAdminClient()

  const { data: tx, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, buyer_id, seller_id, status")
    .eq("id", transactionId)
    .maybeSingle<TransactionRow>()

  if (txError || !tx) {
    throw new Error(txError?.message ?? "Transaction not found")
  }

  if (tx.status === "completed") {
    return { success: true as const, transactionId: tx.id, alreadyCompleted: true as const }
  }

  if (mode === "standard" && tx.buyer_id !== user.id) {
    throw new Error("この取引を完了できるのは購入者のみです。")
  }
  if (mode === "standard" && tx.status !== "approval_pending") {
    throw new Error("取引は完了承認待ち状態ではありません。")
  }
  if (mode === "standard" && tx.status === "disputed") {
    throw new Error("異議申立て中の取引は管理画面の「棄却（取引完了）」から完了してください。")
  }
  if (mode === "dispute_rejection" && tx.status !== "disputed") {
    throw new Error("この取引は異議申立て中ではありません。")
  }

  const nowIso = new Date().toISOString()

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
      throw new Error(updateError.message)
    }
    if (!updated?.length) {
      throw new Error("Transaction was not in disputed status.")
    }
  } else {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        completed_at: nowIso,
        auto_complete_at: null,
      })
      .eq("id", tx.id)
      .eq("status", "approval_pending")
      .select("id")

    if (updateError) {
      throw new Error(updateError.message)
    }
    if (!updated?.length) {
      throw new Error("Transaction was not in approval_pending status.")
    }
  }

  const chatUrl = `${getAppBaseUrl()}/chat/${encodeURIComponent(tx.id)}`

  if (mode === "dispute_rejection") {
    await Promise.all([
      sendUserEventEmail({
        topic: "dispute_result",
        userId: tx.buyer_id,
        subject: "【GritVib】異議申し立てが棄却されました",
        heading: "異議申し立て結果通知",
        intro: "異議申し立ては棄却され、取引は完了しました。",
        ctaLabel: "取引チャットを開く",
        ctaUrl: chatUrl,
      }),
      sendUserEventEmail({
        topic: "dispute_result",
        userId: tx.seller_id,
        subject: "【GritVib】異議申し立てが棄却されました",
        heading: "異議申し立て結果通知",
        intro: "異議申し立ては棄却され、取引は完了しました。",
        ctaLabel: "取引チャットを開く",
        ctaUrl: chatUrl,
      }),
    ])
  } else {
    await Promise.all([
      sendUserEventEmail({
        topic: "transaction_completed",
        userId: tx.buyer_id,
        subject: "【GritVib】取引が完了しました",
        heading: "取引完了通知",
        intro: "対象の取引は完了しました。",
        ctaLabel: "取引チャットを開く",
        ctaUrl: chatUrl,
      }),
      sendUserEventEmail({
        topic: "transaction_completed",
        userId: tx.seller_id,
        subject: "【GritVib】取引が完了しました",
        heading: "取引完了通知",
        intro: "対象の取引は完了しました。",
        ctaLabel: "取引チャットを開く",
        ctaUrl: chatUrl,
      }),
    ])
  }

  return {
    success: true as const,
    transactionId: tx.id,
  }
}

export async function autoCompleteMyPendingTransactionsWithPayout() {
  const { user } = await getAuthedSupabase()
  const supabaseAdmin = getSupabaseAdminClient()
  const cutoffIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: targets, error } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("status", "approval_pending")
    .not("applied_at", "is", null)
    .lt("applied_at", cutoffIso)
    .order("applied_at", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (targets ?? []) as Array<{ id?: string | null }>
  let completedCount = 0
  for (const row of rows) {
    const txId = row.id?.trim()
    if (!txId) {
      continue
    }
    await completeTransactionWithPayout(txId, "standard")
    completedCount += 1
  }

  return { completedCount }
}
