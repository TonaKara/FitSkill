"use server"

import "server-only"

import Stripe from "stripe"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireGritvibAdminUser } from "@/lib/talk/admin-auth"

/**
 * GritVib 管理画面の Stripe 返金関連 Server Actions。
 *
 * 提供:
 *   - `listGritvibAdminMemberChargesAction(memberId)`:
 *       会員の `stripe_customer_id` に紐づく Charge / Invoice / Subscription 情報を返す。
 *       管理画面で返金候補の一覧を出すために使う。
 *   - `refundGritvibAdminChargeAction(paymentIntentId)`:
 *       指定 PaymentIntent (= Stripe の決済) を全額返金する。
 *       既に refunded のものは Stripe 側でエラーになるが、その内容を UI に返す。
 *
 * 認可:
 *   - すべて `requireGritvibAdminUser` でチェック (admin のみ)。
 *   - 操作は Stripe Secret Key を持つサーバー側で完結。
 *
 * 安全策:
 *   - 返金は全額返金のみ (Stripe `refunds.create` で amount を渡さない)。
 *     部分返金は将来必要になったら拡張する。
 *   - 返金後、関連する Subscription をキャンセルするかは UI 側で別操作 (返金 ≠ 自動キャンセル)。
 */

export type GritvibAdminCharge = {
  paymentIntentId: string | null
  chargeId: string
  amount: number
  currency: string
  status: Stripe.Charge.Status
  created: number
  refunded: boolean
  refundedAmount: number
  description: string | null
  receiptUrl: string | null
  invoiceId: string | null
  subscriptionId: string | null
}

type ListChargesResult =
  | { ok: true; charges: GritvibAdminCharge[]; stripeCustomerId: string | null }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "no_customer"
        | "stripe_not_configured"
        | "internal"
    }

type RefundResult =
  | { ok: true; refundId: string; status: Stripe.Refund["status"] | null }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "forbidden"
        | "stripe_not_configured"
        | "already_refunded"
        | "stripe_error"
        | "internal"
      message?: string
    }

function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) {
    return null
  }
  return new Stripe(secret)
}

export async function listGritvibAdminMemberChargesAction(
  memberId: string,
): Promise<ListChargesResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }

  const trimmedMemberId = memberId.trim()
  if (!trimmedMemberId) {
    return { ok: false, reason: "not_found" }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    return { ok: false, reason: "internal" }
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("id, stripe_customer_id")
    .eq("id", trimmedMemberId)
    .maybeSingle()

  if (memberError) {
    console.error("[talk/admin] read member for charges failed", memberError)
    return { ok: false, reason: "internal" }
  }
  if (!member) {
    return { ok: false, reason: "not_found" }
  }
  if (!member.stripe_customer_id) {
    return { ok: true, charges: [], stripeCustomerId: null }
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return { ok: false, reason: "stripe_not_configured" }
  }

  try {
    /**
     * Charge を直接 list する。expand で payment_intent / invoice を引き、refund 状況も合わせて取る。
     * 件数は最大 100 件まで遡る (Stripe の 1 ページ上限)。
     */
    const charges = await stripe.charges.list({
      customer: member.stripe_customer_id,
      limit: 100,
      expand: ["data.payment_intent", "data.invoice"],
    })

    /**
     * Stripe SDK の最新型では `Charge.invoice` が直接プロパティとして公開されていないため、
     * expand で展開した上で安全にアクセスできるよう型を拡張する。
     * invoice は `string | Stripe.Invoice | null` のいずれか。
     */
    type ExpandedCharge = Stripe.Charge & {
      invoice?: string | Stripe.Invoice | null
    }
    type InvoiceWithSubscription = Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }

    const items: GritvibAdminCharge[] = charges.data.map((rawCharge) => {
      const charge = rawCharge as ExpandedCharge
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null
      const invoice = charge.invoice ?? null
      const invoiceId =
        typeof invoice === "string" ? invoice : invoice?.id ?? null
      let subscriptionId: string | null = null
      if (invoice && typeof invoice !== "string") {
        const inv = invoice as InvoiceWithSubscription
        const sub = inv.subscription ?? null
        subscriptionId =
          typeof sub === "string" ? sub : sub?.id ?? null
      }

      return {
        paymentIntentId: piId,
        chargeId: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        created: charge.created,
        refunded: charge.refunded,
        refundedAmount: charge.amount_refunded,
        description: charge.description ?? null,
        receiptUrl: charge.receipt_url ?? null,
        invoiceId,
        subscriptionId,
      }
    })

    return { ok: true, charges: items, stripeCustomerId: member.stripe_customer_id }
  } catch (err) {
    console.error("[talk/admin] stripe charges list failed", err)
    return { ok: false, reason: "internal" }
  }
}

export async function refundGritvibAdminChargeAction(
  paymentIntentId: string,
): Promise<RefundResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }

  const trimmed = paymentIntentId.trim()
  if (!trimmed) {
    return { ok: false, reason: "stripe_error" }
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return { ok: false, reason: "stripe_not_configured" }
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: trimmed,
      /** amount を省略すると全額返金 (Stripe デフォルト挙動)。 */
    })
    return { ok: true, refundId: refund.id, status: refund.status }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      if (err.code === "charge_already_refunded") {
        return { ok: false, reason: "already_refunded" }
      }
      console.error("[talk/admin] stripe refund failed", {
        code: err.code,
        type: err.type,
      })
      return { ok: false, reason: "stripe_error" }
    }
    console.error("[talk/admin] refund unexpected error", err)
    return { ok: false, reason: "internal" }
  }
}
