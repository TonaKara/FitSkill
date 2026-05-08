import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

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

function isMissingStripePaymentIntentColumnError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return normalized.includes("stripe_payment_intent_id") && normalized.includes("could not find")
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

async function ensureSellerPurchaseNotification(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>
  transactionId: string
  sellerId: string
  buyerId: string
  skillId: string
}) {
  const { supabase, transactionId, sellerId, buyerId, skillId } = params

  const { data: existingNotification, error: existingNotificationError } = await supabase
    .from("notifications")
    .select("id")
    .eq("recipient_id", sellerId)
    .eq("type", "purchase")
    .eq("reason", `transaction_id:${transactionId}`)
    .limit(1)
    .maybeSingle()

  if (existingNotificationError) {
    throw new Error(existingNotificationError.message)
  }

  if (existingNotification?.id) {
    return
  }

  const { error: notificationInsertError } = await supabase.from("notifications").insert({
    recipient_id: sellerId,
    sender_id: buyerId,
    type: "purchase",
    title: "新しい購入",
    reason: `transaction_id:${transactionId}`,
    content: "あなたのスキルに新しい購入がありました。チャットを確認してください。",
    is_admin_origin: false,
    is_read: false,
  })

  if (notificationInsertError) {
    throw new Error(notificationInsertError.message)
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_PURCHASE?.trim() ?? ""
  if (webhookUrl) {
    try {
      const [{ data: buyerProfile }, { data: sellerProfile }, { data: skillRow }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", buyerId).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", sellerId).maybeSingle(),
        supabase.from("skills").select("title").eq("id", skillId).maybeSingle(),
      ])
      const buyerName =
        ((buyerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || buyerId
      const sellerName =
        ((sellerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || sellerId
      const skillTitle = ((skillRow as { title?: string | null } | null)?.title ?? "").trim() || skillId
      const baseUrl = getSiteUrl().replace(/\/$/, "")
      await sendDiscordNotification(
        webhookUrl,
        [
          "🛒 **取引開始（購入）**",
          `- 購入者: ${buyerName}`,
          `- 講師: ${sellerName}`,
          `- 商品: ${skillTitle}`,
          `- 取引チャット: ${baseUrl}/chat/${encodeURIComponent(transactionId)}`,
          `- 管理画面: ${baseUrl}/admin`,
        ].join("\n"),
      )
    } catch (discordError) {
      console.error("[stripe-webhook] discord purchase notification failed", discordError)
    }
  }
}

async function createTransactionFromCheckoutSession(session: Stripe.Checkout.Session) {
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
  if (paymentIntentId) {
    const { data: byPaymentIntent, error: byPiError } = await supabase
      .from("transactions")
      .select("id, status")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (byPiError) {
      throw new Error(byPiError.message)
    }
    if (byPaymentIntent?.id) {
      await ensureSellerPurchaseNotification({
        supabase,
        transactionId: String(byPaymentIntent.id),
        sellerId,
        buyerId,
        skillId,
      })
      return
    }
  }

  const transactionIdMeta = session.metadata?.transaction_id?.trim()
  if (transactionIdMeta && paymentIntentId) {
    const { data: targeted, error: targetedError } = await supabase
      .from("transactions")
      .select("id, status, buyer_id, seller_id, skill_id")
      .eq("id", transactionIdMeta)
      .maybeSingle()
    if (targetedError) {
      throw new Error(targetedError.message)
    }
    const tr = targeted as {
      id?: string
      status?: string | null
      buyer_id?: string | null
      seller_id?: string | null
      skill_id?: string | null
    } | null
    if (tr?.id) {
      if (
        String(tr.buyer_id ?? "").trim() !== buyerId ||
        String(tr.seller_id ?? "").trim() !== sellerId ||
        String(tr.skill_id ?? "").trim() !== skillId
      ) {
        throw new Error("Checkout metadata does not match targeted transaction")
      }
      const st = String(tr.status ?? "")
      if (st === "awaiting_payment") {
        let { error: activateError } = await supabase
          .from("transactions")
          .update({
            status: "active",
            stripe_payment_intent_id: paymentIntentId,
            completed_at: null,
            auto_complete_at: null,
          })
          .eq("id", String(tr.id))
          .eq("status", "awaiting_payment")
        if (activateError && isMissingStripePaymentIntentColumnError(activateError.message)) {
          ;({ error: activateError } = await supabase
            .from("transactions")
            .update({
              status: "active",
              completed_at: null,
              auto_complete_at: null,
            })
            .eq("id", String(tr.id))
            .eq("status", "awaiting_payment"))
        }
        if (activateError) {
          throw new Error(activateError.message)
        }
      }
      await ensureSellerPurchaseNotification({
        supabase,
        transactionId: String(tr.id),
        sellerId,
        buyerId,
        skillId,
      })
      return
    }
  }

  const { data: existingTx, error: existingTxError } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("skill_id", skillId)
    .eq("buyer_id", buyerId)
    .in("status", ["awaiting_payment", "pending", "active", "in_progress", "approval_pending", "disputed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingTxError) {
    throw new Error(existingTxError.message)
  }
  if (existingTx?.id) {
    if (existingTx.status === "awaiting_payment") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
      let { error: activateError } = await supabase
        .from("transactions")
        .update({
          status: "active",
          stripe_payment_intent_id: paymentIntentId,
          completed_at: null,
          auto_complete_at: null,
        })
        .eq("id", String(existingTx.id))
        .eq("status", "awaiting_payment")
      if (activateError && isMissingStripePaymentIntentColumnError(activateError.message)) {
        ;({ error: activateError } = await supabase
          .from("transactions")
          .update({
            status: "active",
            completed_at: null,
            auto_complete_at: null,
          })
          .eq("id", String(existingTx.id))
          .eq("status", "awaiting_payment"))
      }
      if (activateError) {
        throw new Error(activateError.message)
      }
    }
    await ensureSellerPurchaseNotification({
      supabase,
      transactionId: String(existingTx.id),
      sellerId,
      buyerId,
      skillId,
    })
    return
  }

  const { data: skill, error: skillError } = await supabase.from("skills").select("price, user_id").eq("id", skillId).maybeSingle()
  if (skillError) {
    throw new Error(skillError.message)
  }
  const skillRow = skill as { price?: unknown; user_id?: string | null } | null
  if (!skillRow || typeof skillRow.price !== "number") {
    throw new Error("Failed to load skill price for checkout completion")
  }
  if ((skillRow.user_id ?? "").trim() !== sellerId) {
    throw new Error("Checkout metadata seller_id does not match skill owner")
  }

  let { data: insertedTransaction, error: insertError } = await supabase
    .from("transactions")
    .insert({
    skill_id: skillId,
    buyer_id: buyerId,
    seller_id: sellerId,
    price: Math.max(0, Math.round(skillRow.price)),
    status: "active",
    stripe_payment_intent_id: paymentIntentId,
    })
    .select("id")
    .single()
  if (insertError && isMissingStripePaymentIntentColumnError(insertError.message)) {
    ;({ data: insertedTransaction, error: insertError } = await supabase
      .from("transactions")
      .insert({
        skill_id: skillId,
        buyer_id: buyerId,
        seller_id: sellerId,
        price: Math.max(0, Math.round(skillRow.price)),
        status: "active",
      })
      .select("id")
      .single())
  }
  if (insertError) {
    throw new Error(insertError.message)
  }

  const insertedTransactionId = String((insertedTransaction as { id?: unknown } | null)?.id ?? "")
  if (!insertedTransactionId) {
    throw new Error("Failed to read inserted transaction id")
  }

  await ensureSellerPurchaseNotification({
    supabase,
    transactionId: insertedTransactionId,
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
        await createTransactionFromCheckoutSession(session)
        break
      }
      case "checkout.session.expired": {
        // 取引は決済完了後に作る方針のため、expired 時点では更新対象なし
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
