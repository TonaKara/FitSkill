"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { canBuyerPurchaseSkill } from "@/lib/consultation"
import { SELLER_FEE_RATE } from "@/lib/seller-fee-preview"
import { assertStripeConnectAccountOwnership } from "@/lib/stripe-account-ownership"

type SkillRow = {
  id: string
  title: string
  user_id: string
  price: number
}

type CreateCheckoutSessionResult =
  | {
      ok: true
      url: string
      checkoutSessionId: string
    }
  | {
      ok: false
      error: string
    }

type FinalizeCheckoutSessionResult =
  | {
      ok: true
      transactionId: string
      status: string
    }
  | {
      ok: false
      error: string
    }

function isMissingStripePaymentIntentColumnError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return normalized.includes("stripe_payment_intent_id") && normalized.includes("could not find")
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

function computeApplicationFeeAmount(totalAmountYen: number): number {
  // 規約の手数料率 12% を円単位で適用（小数点以下は切り捨て）
  return Math.floor(totalAmountYen * SELLER_FEE_RATE)
}

async function holdSellerPayoutsManually(
  stripe: Stripe,
  connectedAccountId: string,
): Promise<void> {
  await stripe.accounts.update(connectedAccountId, {
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  })
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function ensureSellerPurchaseNotification(params: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>
  transactionId: string
  sellerId: string
  buyerId: string
}) {
  const { supabaseAdmin, transactionId, sellerId, buyerId } = params

  const { data: existingNotification, error: existingNotificationError } = await supabaseAdmin
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

  const { error: notificationInsertError } = await supabaseAdmin.from("notifications").insert({
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

export async function createCheckoutSession(skillId: string | number): Promise<CreateCheckoutSessionResult> {
  try {
    const normalizedSkillId = String(skillId ?? "").trim()
    if (!normalizedSkillId) {
      return { ok: false, error: "skillId is required" }
    }

    const { supabase, user } = await getAuthedSupabase()
    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, title, user_id, price")
      .eq("id", normalizedSkillId)
      .single<SkillRow>()

    if (skillError || !skill) {
      return { ok: false, error: skillError?.message ?? "Skill not found" }
    }

    if (skill.user_id === user.id) {
      return { ok: false, error: "You cannot purchase your own skill" }
    }

    const consultationGate = await canBuyerPurchaseSkill(supabase, skill.id, user.id)
    if (!consultationGate.allowed) {
      if (consultationGate.error) {
        return { ok: false, error: "購入条件の確認に失敗しました。時間をおいて再度お試しください。" }
      }
      if (consultationGate.answerStatus === "pending") {
        return { ok: false, error: "相談リクエストが承認待ちです。承認後に購入できます。" }
      }
      if (consultationGate.answerStatus === "rejected") {
        return { ok: false, error: "相談リクエストが拒否されています。再度申請して承認を待ってください。" }
      }
      return { ok: false, error: "このスキルは事前相談の承認後に購入できます。" }
    }

    const amount = Math.max(0, Math.round(Number(skill.price)))
    if (amount < 1) {
      return { ok: false, error: "Invalid skill price" }
    }
    const applicationFeeAmount = computeApplicationFeeAmount(amount)

    const { data: sellerProfile, error: spErr } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", skill.user_id)
      .maybeSingle()
    if (spErr) {
      return { ok: false, error: spErr.message }
    }
    const sp = sellerProfile as {
      stripe_connect_account_id?: string | null
      stripe_connect_charges_enabled?: boolean | null
    } | null
    if (!sp?.stripe_connect_account_id?.trim() || sp.stripe_connect_charges_enabled !== true) {
      return {
        ok: false,
        error:
          "講師の振込先（Stripe）の登録が完了していないため、オンライン決済できません。しばらくしてから再度お試しください。",
      }
    }

    const sellerConnectAccountId = sp.stripe_connect_account_id.trim()
    await assertStripeConnectAccountOwnership({
      stripe,
      accountId: sellerConnectAccountId,
      expectedUserId: skill.user_id,
    })

    // 決済後の資金は講師Connect口座へ移しつつ、銀行振込は取引完了まで手動保留にする。
    await holdSellerPayoutsManually(stripe, sellerConnectAccountId)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: {
              name: skill.title,
            },
          },
        },
      ],
      success_url: `${appUrl}/skills/${skill.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/skills/${skill.id}?checkout=cancel`,
      payment_intent_data: {
        capture_method: "automatic",
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: sellerConnectAccountId,
        },
        metadata: {
          payout_policy: "destination_charge_manual_payout_hold_until_completion",
          platform_fee_amount: String(applicationFeeAmount),
        },
      },
      metadata: {
        skill_id: skill.id,
        buyer_id: user.id,
        seller_id: skill.user_id,
        amount: String(amount),
      },
    })

    if (!session.url) {
      return { ok: false, error: "Failed to create checkout session URL" }
    }

    return {
      ok: true,
      url: session.url,
      checkoutSessionId: session.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "決済セッション作成中に不明なエラーが発生しました。"
    console.error("[createCheckoutSession] unexpected error", {
      skillId: String(skillId ?? ""),
      message,
      error,
    })
    return { ok: false, error: message }
  }
}

export async function finalizeCheckoutSessionAfterSuccess(
  checkoutSessionId: string | null | undefined,
): Promise<FinalizeCheckoutSessionResult> {
  try {
    const normalizedSessionId = String(checkoutSessionId ?? "").trim()
    if (!normalizedSessionId) {
      return { ok: false, error: "session_id is required" }
    }

    const { user } = await getAuthedSupabase()
    const stripe = getStripeClient()
    const supabaseAdmin = getSupabaseAdminClient()

    const session = await stripe.checkout.sessions.retrieve(normalizedSessionId)
    if (session.payment_status !== "paid") {
      return { ok: false, error: "決済完了の確認が取れませんでした。" }
    }

    const skillId = session.metadata?.skill_id?.trim()
    const buyerId = session.metadata?.buyer_id?.trim()
    const sellerId = session.metadata?.seller_id?.trim()
    if (!skillId || !buyerId || !sellerId) {
      return { ok: false, error: "決済メタデータが不足しています。" }
    }
    if (buyerId !== user.id) {
      return { ok: false, error: "この決済を確定する権限がありません。" }
    }

    const { data: existingTx, error: existingTxError } = await supabaseAdmin
      .from("transactions")
      .select("id, status")
      .eq("skill_id", skillId)
      .eq("buyer_id", buyerId)
      .in("status", ["awaiting_payment", "pending", "active", "in_progress", "approval_pending", "disputed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingTxError) {
      return { ok: false, error: existingTxError.message }
    }

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null
    if (existingTx?.id) {
      if (existingTx.status === "awaiting_payment") {
        let { data: activatedTx, error: activateError } = await supabaseAdmin
          .from("transactions")
          .update({
            status: "active",
            stripe_payment_intent_id: paymentIntentId,
            completed_at: null,
            auto_complete_at: null,
          })
          .eq("id", String(existingTx.id))
          .eq("status", "awaiting_payment")
          .select("id, status")
          .maybeSingle()

        if (activateError && isMissingStripePaymentIntentColumnError(activateError.message)) {
          ;({ data: activatedTx, error: activateError } = await supabaseAdmin
            .from("transactions")
            .update({
              status: "active",
              completed_at: null,
              auto_complete_at: null,
            })
            .eq("id", String(existingTx.id))
            .eq("status", "awaiting_payment")
            .select("id, status")
            .maybeSingle())
        }
        if (activateError) {
          return { ok: false, error: activateError.message }
        }
        if (!activatedTx?.id || !activatedTx?.status) {
          return { ok: false, error: "取引開始状態への更新に失敗しました。" }
        }
        await ensureSellerPurchaseNotification({
          supabaseAdmin,
          transactionId: String(activatedTx.id),
          sellerId,
          buyerId,
        })
        return { ok: true, transactionId: String(activatedTx.id), status: String(activatedTx.status) }
      }
      if (String(existingTx.status) !== "awaiting_payment") {
        await ensureSellerPurchaseNotification({
          supabaseAdmin,
          transactionId: String(existingTx.id),
          sellerId,
          buyerId,
        })
      }
      return { ok: true, transactionId: String(existingTx.id), status: String(existingTx.status) }
    }

    const { data: skill, error: skillError } = await supabaseAdmin
      .from("skills")
      .select("price, user_id")
      .eq("id", skillId)
      .maybeSingle()
    if (skillError) {
      return { ok: false, error: skillError.message }
    }
    const skillRow = skill as { price?: unknown; user_id?: string | null } | null
    if (!skillRow || typeof skillRow.price !== "number") {
      return { ok: false, error: "スキル価格の取得に失敗しました。" }
    }
    if ((skillRow.user_id ?? "").trim() !== sellerId) {
      return { ok: false, error: "決済情報と出品者情報が一致しません。" }
    }

    let { data: insertedTx, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        skill_id: skillId,
        buyer_id: buyerId,
        seller_id: sellerId,
        price: Math.max(0, Math.round(skillRow.price)),
        status: "active",
        stripe_payment_intent_id: paymentIntentId,
      })
      .select("id, status")
      .single()

    if (insertError && isMissingStripePaymentIntentColumnError(insertError.message)) {
      ;({ data: insertedTx, error: insertError } = await supabaseAdmin
        .from("transactions")
        .insert({
          skill_id: skillId,
          buyer_id: buyerId,
          seller_id: sellerId,
          price: Math.max(0, Math.round(skillRow.price)),
          status: "active",
        })
        .select("id, status")
        .single())
    }
    if (insertError) {
      return { ok: false, error: insertError.message }
    }
    if (!insertedTx?.id || !insertedTx?.status) {
      return { ok: false, error: "取引作成に失敗しました。" }
    }

    await ensureSellerPurchaseNotification({
      supabaseAdmin,
      transactionId: String(insertedTx.id),
      sellerId,
      buyerId,
    })

    return { ok: true, transactionId: String(insertedTx.id), status: String(insertedTx.status) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "決済反映中に不明なエラーが発生しました。"
    console.error("[finalizeCheckoutSessionAfterSuccess] unexpected error", {
      checkoutSessionId: String(checkoutSessionId ?? ""),
      message,
      error,
    })
    return { ok: false, error: message }
  }
}
