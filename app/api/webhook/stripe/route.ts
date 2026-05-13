import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import {
  claimSkillApplicationAfterPayment,
  parseCheckoutReservationUuidFromMetadata,
  refundPaidCheckoutSession,
  releaseSkillCheckoutReservation,
  resolveStripePaymentIntentIdForCheckoutSession,
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

type StripeWebhookEventRow = {
  processed_at?: string | null
}

function isMissingStripeWebhookEventsTableError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return (
    normalized.includes("stripe_webhook_events") &&
    (normalized.includes("does not exist") || normalized.includes("could not find"))
  )
}

function isDuplicateStripeWebhookEventError(error: { code?: string; message?: string }): boolean {
  const code = String(error.code ?? "")
  if (code === "23505") {
    return true
  }
  const normalized = String(error.message ?? "").toLowerCase()
  return normalized.includes("duplicate key")
}

async function claimStripeWebhookEvent(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  eventId: string,
): Promise<"process" | "skip_completed"> {
  const { error } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: eventId,
    received_at: new Date().toISOString(),
  })
  if (!error) {
    return "process"
  }
  if (isMissingStripeWebhookEventsTableError(error.message)) {
    return "process"
  }
  if (!isDuplicateStripeWebhookEventError(error)) {
    throw new Error(error.message)
  }

  const { data, error: existingError } = await supabase
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("stripe_event_id", eventId)
    .maybeSingle()
  if (existingError) {
    if (isMissingStripeWebhookEventsTableError(existingError.message)) {
      return "process"
    }
    throw new Error(existingError.message)
  }

  const processedAt = (data as StripeWebhookEventRow | null)?.processed_at
  if (processedAt) {
    return "skip_completed"
  }
  return "process"
}

async function markStripeWebhookEventProcessed(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("stripe_event_id", eventId)
  if (!error) {
    return
  }
  if (isMissingStripeWebhookEventsTableError(error.message)) {
    return
  }
  throw new Error(error.message)
}

async function recordStripeWebhookEventFailure(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  eventId: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      last_error: message.slice(0, 1000),
    })
    .eq("stripe_event_id", eventId)
    .is("processed_at", null)
  if (!error) {
    return
  }
  if (isMissingStripeWebhookEventsTableError(error.message)) {
    return
  }
  throw new Error(error.message)
}

async function createTransactionFromCheckoutSession(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.payment_status !== "paid") {
    return
  }

  const supabase = getSupabaseAdminClient()

  const skillId = session.metadata?.skill_id?.trim()
  const buyerId = session.metadata?.buyer_id?.trim()
  const sellerId = session.metadata?.seller_id?.trim()
  if (!skillId || !buyerId || !sellerId) {
    throw new Error("checkout.session.completed metadata is missing required ids")
  }
  if (buyerId === sellerId) {
    throw new Error("Invalid checkout session metadata: buyer and seller are same")
  }

    const paymentIntentId = await resolveStripePaymentIntentIdForCheckoutSession(stripe, session)
    const transactionIdMeta = session.metadata?.transaction_id?.trim() || null
    const checkoutReservationId = parseCheckoutReservationUuidFromMetadata(
      session.metadata?.checkout_reservation_id,
    )

    const claimResult = await claimSkillApplicationAfterPayment(supabase, {
      skillId,
      buyerId,
      sellerId,
      stripePaymentIntentId: paymentIntentId,
      targetTransactionId: transactionIdMeta,
      stripeCheckoutSessionId: session.id,
      checkoutReservationId,
    })

  if (!claimResult.ok) {
    // skill_full / duplicate_payment など: 決済は取り込まず自動返金（事後検証）
    try {
      const refundResult = await refundPaidCheckoutSession(stripe, session)
      if (refundResult.created) {
        await notifyBuyerCheckoutRefunded({
          supabaseAdmin: supabase,
          buyerId,
          skillId,
          reason: claimResult.reason,
        })
      }
    } catch (refundError) {
      console.error("[stripe webhook] refund after failed claim", {
        checkoutSessionId: session.id,
        reason: claimResult.reason,
        message: refundError instanceof Error ? refundError.message : String(refundError),
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
    const claimState = await claimStripeWebhookEvent(supabase, event.id)
    if (claimState === "skip_completed") {
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
      case "checkout.session.async_payment_succeeded": {
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

    await markStripeWebhookEventProcessed(supabase, event.id)

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      const supabase = getSupabaseAdminClient()
      await recordStripeWebhookEventFailure(supabase, event.id, message)
    } catch (recordError) {
      console.error("[stripe webhook] failed to record webhook failure", recordError)
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
