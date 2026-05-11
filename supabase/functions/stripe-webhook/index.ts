import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import Stripe from "npm:stripe@17.5.0"

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent
      const transactionId = pi.metadata?.transaction_id?.trim()
      const checkoutSkillId = pi.metadata?.skill_id?.trim()
      if (!transactionId) {
        if (checkoutSkillId) {
          return new Response(
            JSON.stringify({ received: true, skipped: "checkout flow handled by app webhook" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
        return new Response(JSON.stringify({ received: true, skipped: "no transaction_id in metadata" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      const { data: updated, error: upErr } = await supabaseAdmin
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", transactionId)
        .eq("stripe_payment_intent_id", pi.id)
        .in("status", ["awaiting_payment"])
        .select("id, seller_id, buyer_id, skill_id")
        .maybeSingle()

      if (upErr) {
        console.error("[stripe-webhook] transaction update error", upErr)
        return new Response(JSON.stringify({ error: upErr.message }), { status: 500 })
      }

      if (updated) {
        const row = updated as { seller_id: string; buyer_id: string }
        const { error: nErr } = await supabaseAdmin.from("notifications").insert({
          recipient_id: row.seller_id,
          sender_id: row.buyer_id,
          type: "purchase",
          title: "新しい購入",
          reason: `transaction_id:${transactionId}`,
          content: "あなたのスキルに新しい購入がありました。チャットを確認してください。",
          is_admin_origin: false,
          is_read: false,
        })
        if (nErr) {
          console.error("[stripe-webhook] notification insert", nErr)
        }
      }
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account
      if (account.id) {
        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({
            stripe_connect_charges_enabled: account.charges_enabled ?? false,
            stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
            stripe_connect_details_submitted: account.details_submitted ?? false,
            ...(account.charges_enabled && account.details_submitted ? { is_stripe_registered: true } : {}),
          })
          .eq("stripe_connect_account_id", account.id)
        if (profErr) {
          console.error("[stripe-webhook] profile stripe flags", profErr)
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[stripe-webhook]", msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
