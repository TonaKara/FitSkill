import type { SupabaseClient } from "@supabase/supabase-js"
import { canBuyerPurchaseSkill } from "@/lib/consultation"

/** 重複 INSERT（unique 制約）かどうか */
function isUniqueConstraintViolation(error: { code?: string; message?: string }): boolean {
  if (error.code === "23505") {
    return true
  }
  const m = (error.message ?? "").toLowerCase()
  return m.includes("duplicate key") || m.includes("unique constraint") || m.includes("already exists")
}

export const ONGOING_PURCHASE_STATUSES = [
  "awaiting_payment",
  "pending",
  "in_progress",
  "active",
  "approval_pending",
  "disputed",
] as const

/**
 * スキルごとの「枠の使用数」（進行中取引 + Stripe Checkout に遷移済みの有効な仮押さえ）。
 * RPC `count_active_transactions_for_skill`（仮押さえは `stripe_checkout_session_id` 付与後のみ加算）。
 */
export async function countActiveTransactionsForSkill(
  supabase: SupabaseClient,
  skillId: string,
): Promise<number> {
  const parsedSkillId = Number(skillId)
  if (!Number.isFinite(parsedSkillId)) {
    return 0
  }

  const { data, error } = await supabase.rpc("count_active_transactions_for_skill", {
    p_skill_id: Math.trunc(parsedSkillId),
  })
  if (error || data === null || data === undefined) {
    return 0
  }

  const n = Number(data)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/**
 * スキル詳細の「満枠」表示用。グローバル枠数は `count_active_transactions_for_skill` と同じ定義。
 * 閲覧者が自分の「Stripe 遷移済み」仮押さえを持つときだけグローバルから 1 を引く（自分の枠で満枠表示にならないようにする）。
 */
export async function countActiveSlotsForSkillPurchaseDisplay(
  supabase: SupabaseClient,
  skillId: string,
  viewerUserId: string | null | undefined,
): Promise<number | null> {
  const parsedSkillId = Number(skillId)
  if (!Number.isFinite(parsedSkillId)) {
    return null
  }
  if (!viewerUserId?.trim()) {
    const n = await countActiveTransactionsForSkill(supabase, skillId)
    return n
  }

  const { data, error } = await supabase.rpc("count_skill_slots_for_viewer_purchase", {
    p_skill_id: Math.trunc(parsedSkillId),
  })
  if (error || data === null || data === undefined) {
    return null
  }

  const n = Number(data)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null
}

export async function findOngoingPurchaseTransactionForSkill(
  supabase: SupabaseClient,
  params: { skillId: string; buyerId: string },
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("skill_id", params.skillId)
    .eq("buyer_id", params.buyerId)
    .in("status", [...ONGOING_PURCHASE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return null
  }

  const row = data as { id?: unknown; status?: unknown } | null
  const id = row?.id
  const status = row?.status
  if (typeof id === "string" && id.length > 0 && typeof status === "string" && status.length > 0) {
    return { id, status }
  }
  return null
}

/**
 * 同一スキル・同一買い手の active 取引があればその id（重複購入判定用）。
 */
export async function getActivePurchaseTransactionIdForSkill(
  supabase: SupabaseClient,
  params: { skillId: string; buyerId: string },
): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user?.id || authData.user.id !== params.buyerId) {
    return null
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("skill_id", params.skillId)
    .eq("buyer_id", params.buyerId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (error) {
    return null
  }

  const row = data as { id?: unknown } | null
  const id = row?.id
  if (typeof id === "string" && id.length > 0) {
    return id
  }
  return null
}

export async function createSkillPurchaseTransaction(
  supabase: SupabaseClient,
  params: { skillId: string; buyerId: string },
): Promise<{
  inserted: boolean
  errorMessage: string | null
  transactionId?: string | null
  requiresPayment?: boolean
}> {
  const consultationGate = await canBuyerPurchaseSkill(supabase, params.skillId, params.buyerId)
  if (!consultationGate.allowed) {
    if (consultationGate.error) {
      return { inserted: false, errorMessage: "購入条件の確認に失敗しました。時間をおいて再度お試しください。" }
    }
    if (consultationGate.answerStatus === "pending") {
      return { inserted: false, errorMessage: "相談リクエストが承認待ちです。承認後に購入できます。" }
    }
    if (consultationGate.answerStatus === "rejected") {
      return { inserted: false, errorMessage: "相談リクエストが拒否されています。再度申請して承認を待ってください。" }
    }
    return { inserted: false, errorMessage: "このスキルは事前相談の承認後に購入できます。" }
  }

  const { data: skill, error: skillError } = await supabase
    .from("skills")
    .select("price, user_id, title")
    .eq("id", params.skillId)
    .single()

  if (skillError) {
    return { inserted: false, errorMessage: skillError.message }
  }

  const skillRow = skill as { price: unknown; user_id: string | null; title?: string | null } | null
  if (!skillRow || typeof skillRow.price !== "number") {
    return { inserted: false, errorMessage: "スキルの価格を取得できませんでした。" }
  }
  const sellerId = (skillRow.user_id ?? "").trim()
  if (!sellerId) {
    return { inserted: false, errorMessage: "講師情報の取得に失敗しました。" }
  }

  // 支払い導線の安全性を優先:
  // 購入フローは常に Stripe Connect 登録済み講師のオンライン決済を前提にし、
  // 取引作成時は必ず awaiting_payment で開始する。
  const { data: sellerProfile, error: spErr } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_charges_enabled")
    .eq("id", sellerId)
    .maybeSingle()

  if (spErr) {
    return { inserted: false, errorMessage: spErr.message }
  }

  const sp = sellerProfile as {
    stripe_connect_account_id?: string | null
    stripe_connect_charges_enabled?: boolean | null
  } | null

  if (!sp?.stripe_connect_account_id?.trim() || sp.stripe_connect_charges_enabled !== true) {
    return {
      inserted: false,
      errorMessage:
        "講師の振込先（Stripe）の登録が完了していないため、オンライン決済できません。しばらくしてから再度お試しください。",
    }
  }

  const initialStatus: "awaiting_payment" = "awaiting_payment"

  const { data: insertedRow, error: insertError } = await supabase
    .from("transactions")
    .insert({
      skill_id: params.skillId,
      buyer_id: params.buyerId,
      seller_id: sellerId,
      price: skillRow.price,
      status: initialStatus,
    })
    .select("id")
    .single()

  if (insertError) {
    if (isUniqueConstraintViolation(insertError)) {
      const { data: dupRow, error: dupErr } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("skill_id", params.skillId)
        .eq("buyer_id", params.buyerId)
        .eq("status", "awaiting_payment")
        .maybeSingle()

      if (!dupErr && dupRow && typeof (dupRow as { id?: unknown }).id === "string") {
        const dupId = String((dupRow as { id: string }).id)
        return {
          inserted: true,
          errorMessage: null,
          transactionId: dupId,
          requiresPayment: initialStatus === "awaiting_payment",
        }
      }

      return {
        inserted: false,
        errorMessage:
          "同じスキルの購入手続きが別タブなどで進行中です。ページを更新してから再度お試しください。",
      }
    }
    return { inserted: false, errorMessage: insertError.message }
  }

  const newTxId = (insertedRow as { id?: unknown } | null)?.id
  const txIdStr = typeof newTxId === "string" && newTxId.length > 0 ? newTxId : null

  return {
    inserted: true,
    errorMessage: null,
    transactionId: txIdStr,
    requiresPayment: initialStatus === "awaiting_payment",
  }
}

type AutoCompleteOptions = {
  userId?: string
  now?: Date
}

/**
 * approval_pending かつ applied_at から3日経過した取引を自動完了にする。
 * userId を渡した場合、そのユーザーが当事者の取引だけ対象にする。
 */
export async function autoCompleteTransactions(
  supabase: SupabaseClient,
  options?: AutoCompleteOptions,
): Promise<number> {
  const now = options?.now ?? new Date()
  const nowIso = now.toISOString()
  const cutoffIso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from("transactions")
    .update({
      status: "completed",
      completed_at: nowIso,
      auto_complete_at: null,
    })
    .eq("status", "approval_pending")
    .not("applied_at", "is", null)
    .lt("applied_at", cutoffIso)

  if (options?.userId) {
    query = query.or(`buyer_id.eq.${options.userId},seller_id.eq.${options.userId}`)
  }

  const { data, error } = await query.select("id")
  if (error) {
    console.error("【自動完了更新エラー】", error)
    return 0
  }

  const updatedCount = Array.isArray(data) ? data.length : 0
  if (updatedCount > 0) {
    const updatedRows = (Array.isArray(data) ? data : []) as Array<{ id?: string | null }>
    for (const row of updatedRows) {
      const txId = row.id?.trim()
      if (!txId) {
        continue
      }
      try {
        await fetch("/api/notifications/event-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "transaction_completed",
            transactionId: txId,
          }),
        })
      } catch {
        // メール通知失敗で自動完了処理を失敗扱いにしない
      }
    }
  }

  return updatedCount
}
