import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import {
  claimSkillApplicationAfterPayment,
  refundPaidCheckoutSession,
  releaseSkillCheckoutReservation,
} from "@/lib/checkout-fulfillment"
import { ensureSellerPurchaseNotification, notifyBuyerCheckoutRefunded } from "@/lib/purchase-notification"

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

function getStripeClient() {
  return new Stripe(getEnv("STRIPE_SECRET_KEY"))
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function markStripeEventAsProcessing(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  eventId: string,
): Promise<"new" | "already_processed"> {
  const { data, error } = await supabase
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: eventId,
      received_at: new Date().toISOString(),
    })
    .select("stripe_event_id")
    .maybeSingle()
  if (!error) {
    return data?.stripe_event_id ? "new" : "new"
  }
  const normalized = String(error.message ?? "").toLowerCase()
  if (
    normalized.includes("stripe_webhook_events") &&
    (normalized.includes("does not exist") || normalized.includes("could not find"))
  ) {
    // 冪等テーブル未作成環境では従来動作を維持（要SQL適用）
    return "new"
  }
  if ((error as { code?: string }).code === "23505" || normalized.includes("duplicate key")) {
    return "already_processed"
  }
  throw new Error(error.message)
}

async function createTransactionFromCheckoutSession(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.payment_status !== "paid") {
    return
  }
  const skillId = session.metadata?.skill_id?.trim()
  const buyerId = session.metadata?.buyer_id?.trim()
  const sellerId = session.metadata?.seller_id?.trim()
  if (!skillId || !buyerId || !sellerId) {
    throw new Error("checkout.session.completed metadata is missing required ids")
  }
  if (buyerId === sellerId) {
    throw new Error("Invalid checkout session metadata: buyer and seller are same")
  }

  const supabase = getSupabaseAdminClient()
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
  const transactionIdMeta = session.metadata?.transaction_id?.trim() || null

  const claimResult = await claimSkillApplicationAfterPayment(supabase, {
    skillId,
    buyerId,
    sellerId,
    stripePaymentIntentId: paymentIntentId,
    targetTransactionId: transactionIdMeta,
    stripeCheckoutSessionId: session.id,
  })

  if (!claimResult.ok) {
    const refundResult = await refundPaidCheckoutSession(stripe, session)
    if (refundResult.created) {
      await notifyBuyerCheckoutRefunded({
        supabaseAdmin: supabase,
        buyerId,
        skillId,
        reason: claimResult.reason,
      })
    }
    console.warn("[stripe webhook] checkout claim rejected; refunded checkout session", {
      skillId,
      buyerId,
      paymentIntentId,
      checkoutSessionId: session.id,
      reason: claimResult.reason,
    })
    return
  }

  const transactionId = claimResult.row.transaction_id

  await ensureSellerPurchaseNotification({
    supabaseAdmin: supabase,
    transactionId,
    sellerId,
    buyerId,
    skillId,
  })
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  const payload = await req.text()
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, getEnv("STRIPE_WEBHOOK_SECRET"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdminClient()
    const processingState = await markStripeEventAsProcessing(supabase, event.id)
    if (processingState === "already_processed") {
      return new Response(JSON.stringify({ received: true, skipped: "duplicate_event" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await createTransactionFromCheckoutSession(session, stripe)
        break
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        await releaseSkillCheckoutReservation(supabase, { checkoutSessionId: session.id })
        break
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        if (account.id) {
          const { error: profileErr } = await supabase
            .from("profiles")
            .update({
              stripe_connect_charges_enabled: account.charges_enabled ?? false,
              stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
              stripe_connect_details_submitted: account.details_submitted ?? false,
              ...(account.charges_enabled && account.details_submitted ? { is_stripe_registered: true } : {}),
            })
            .eq("stripe_connect_account_id", account.id)
          if (profileErr) {
            console.error("[stripe webhook] profile stripe flags", profileErr)
            throw new Error(profileErr.message)
          }
        }
        break
      }
      case "payment_intent.payment_failed": {
        // 取引は決済完了後に作る方針のため、failure 時点では更新対象なし
        break
      }
      default:
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
