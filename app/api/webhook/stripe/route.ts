import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

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

async function updateTransactionStatus(transactionId: string | undefined, status: "active" | "failed_or_expired") {
  if (!transactionId?.trim()) {
    return
  }
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("transactions").update({ status }).eq("id", transactionId)
  if (error) {
    throw new Error(error.message)
  }
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await updateTransactionStatus(session.metadata?.transaction_id, "active")
        break
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        await updateTransactionStatus(session.metadata?.transaction_id, "failed_or_expired")
        break
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent
        const transactionId = intent.metadata?.transaction_id
        await updateTransactionStatus(transactionId, "failed_or_expired")
        if (intent.last_payment_error?.message) {
          console.error("[stripe webhook] payment failed", {
            transactionId,
            paymentIntentId: intent.id,
            reason: intent.last_payment_error.message,
          })
        }
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
