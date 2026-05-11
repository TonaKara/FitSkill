import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"

export type ClaimSkillApplicationAfterPaymentRow = {
  transaction_id: string
  status: string
  already_existed: boolean
}

export type ClaimSkillApplicationAfterPaymentResult =
  | {
      ok: true
      row: ClaimSkillApplicationAfterPaymentRow
    }
  | {
      ok: false
      reason: "skill_full" | "duplicate_payment"
    }

export type ReserveSkillCheckoutSlotResult =
  | {
      ok: true
      reservationId: string
    }
  | {
      ok: false
      reason: "skill_full" | "ongoing_purchase"
      errorMessage: string
    }

function isRpcError(error: { code?: string; message?: string }, token: string, code?: string): boolean {
  if (code && String(error.code ?? "").toUpperCase() === code) {
    return true
  }
  return String(error.message ?? "").toLowerCase().includes(token)
}

export function isSkillFullRpcError(error: { code?: string; message?: string }): boolean {
  return isRpcError(error, "skill_full", "SKF01")
}

export function isOngoingPurchaseRpcError(error: { code?: string; message?: string }): boolean {
  return isRpcError(error, "ongoing_purchase", "SKO01")
}

export function isDuplicatePaymentRpcError(error: { code?: string; message?: string }): boolean {
  return isRpcError(error, "duplicate_payment", "SKD01")
}

export function isCheckoutCapacityFinalizeError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return (
    normalized.includes("申し込み枠が満杯") ||
    normalized.includes("自動返金") ||
    normalized.includes("重複した決済")
  )
}

export type CheckoutRefundResult = {
  created: boolean
}

export async function refundStripePaymentIntent(
  stripe: Stripe,
  paymentIntentId: string,
): Promise<CheckoutRefundResult> {
  const normalizedPaymentIntentId = paymentIntentId.trim()
  if (!normalizedPaymentIntentId) {
    throw new Error("Cannot refund without payment_intent")
  }

  const existingRefunds = await stripe.refunds.list({
    payment_intent: normalizedPaymentIntentId,
    limit: 1,
  })
  if (existingRefunds.data.length > 0) {
    return { created: false }
  }

  await stripe.refunds.create({
    payment_intent: normalizedPaymentIntentId,
    reverse_transfer: true,
    refund_application_fee: true,
  })
  return { created: true }
}

export async function refundPaidCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<CheckoutRefundResult> {
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
  if (!paymentIntentId) {
    throw new Error("Cannot refund checkout session without payment_intent")
  }
  return refundStripePaymentIntent(stripe, paymentIntentId)
}

export async function reserveSkillCheckoutSlot(
  supabaseAdmin: SupabaseClient,
  params: {
    skillId: string
    buyerId: string
    sellerId: string
    ttlMinutes?: number
  },
): Promise<ReserveSkillCheckoutSlotResult> {
  const parsedSkillId = Number(params.skillId)
  if (!Number.isFinite(parsedSkillId)) {
    throw new Error("Invalid skill_id")
  }

  const { data, error } = await supabaseAdmin.rpc("reserve_skill_checkout_slot", {
    p_skill_id: Math.trunc(parsedSkillId),
    p_buyer_id: params.buyerId,
    p_seller_id: params.sellerId,
    p_ttl_minutes: params.ttlMinutes ?? 35,
  })

  if (error) {
    if (isSkillFullRpcError(error)) {
      return {
        ok: false,
        reason: "skill_full",
        errorMessage: "申し込み枠が満杯のため、現在購入できません。",
      }
    }
    if (isOngoingPurchaseRpcError(error)) {
      return {
        ok: false,
        reason: "ongoing_purchase",
        errorMessage: "このスキルはすでに購入手続き中です。取引チャットをご確認ください。",
      }
    }
    throw new Error(error.message)
  }

  const reservationId = String(data ?? "").trim()
  if (!reservationId) {
    throw new Error("Failed to read reservation id from reserve_skill_checkout_slot")
  }

  return { ok: true, reservationId }
}

export async function attachSkillCheckoutReservationSession(
  supabaseAdmin: SupabaseClient,
  params: {
    reservationId: string
    checkoutSessionId: string
  },
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("attach_skill_checkout_reservation_session", {
    p_reservation_id: params.reservationId,
    p_stripe_checkout_session_id: params.checkoutSessionId,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseSkillCheckoutReservation(
  supabaseAdmin: SupabaseClient,
  params: {
    checkoutSessionId?: string | null
    reservationId?: string | null
  },
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("release_skill_checkout_reservation", {
    p_stripe_checkout_session_id: params.checkoutSessionId ?? null,
    p_reservation_id: params.reservationId ?? null,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function claimSkillApplicationAfterPayment(
  supabaseAdmin: SupabaseClient,
  params: {
    skillId: string
    buyerId: string
    sellerId: string
    stripePaymentIntentId: string | null
    targetTransactionId: string | null
    stripeCheckoutSessionId?: string | null
  },
): Promise<ClaimSkillApplicationAfterPaymentResult> {
  const parsedSkillId = Number(params.skillId)
  if (!Number.isFinite(parsedSkillId)) {
    throw new Error("Invalid skill_id")
  }

  const { data, error } = await supabaseAdmin.rpc("claim_skill_application_after_payment", {
    p_skill_id: Math.trunc(parsedSkillId),
    p_buyer_id: params.buyerId,
    p_seller_id: params.sellerId,
    p_stripe_payment_intent_id: params.stripePaymentIntentId,
    p_target_transaction_id: params.targetTransactionId,
    p_stripe_checkout_session_id: params.stripeCheckoutSessionId ?? null,
  })

  if (error) {
    if (isSkillFullRpcError(error)) {
      return { ok: false, reason: "skill_full" }
    }
    if (isDuplicatePaymentRpcError(error)) {
      return { ok: false, reason: "duplicate_payment" }
    }
    throw new Error(error.message)
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as ClaimSkillApplicationAfterPaymentRow[]
  const claimed = rows[0]
  const transactionId = String(claimed?.transaction_id ?? "").trim()
  if (!transactionId) {
    throw new Error("Failed to read transaction id from claim_skill_application_after_payment")
  }

  return {
    ok: true,
    row: {
      transaction_id: transactionId,
      status: String(claimed?.status ?? "active"),
      already_existed: claimed?.already_existed === true,
    },
  }
}
