"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import Stripe from "stripe"
import {
  attachSkillCheckoutReservationSession,
  claimSkillApplicationAfterPayment,
  parseCheckoutReservationUuidFromMetadata,
  refundPaidCheckoutSession,
  releaseSkillCheckoutReservation,
  releaseSkillCheckoutReservationBestEffort,
  reserveSkillCheckoutSlot,
  resolveStripePaymentIntentIdForCheckoutSession,
  type ClaimSkillApplicationAfterPaymentResult,
} from "@/lib/checkout-fulfillment"
import { canBuyerPurchaseSkill } from "@/lib/consultation"
import { ensureSellerPurchaseNotification, notifyBuyerCheckoutRefunded } from "@/lib/purchase-notification"
import { SELLER_FEE_RATE } from "@/lib/seller-fee-preview"
import { getAppBaseUrl } from "@/lib/site-seo"
import { assertStripeConnectAccountOwnership } from "@/lib/stripe-account-ownership"
import { normalizeCurrency, toStripeCurrencyCode } from "@/lib/currency"

type SkillRow = {
  id: string
  title: string
  user_id: string
  price: number
  /**
   * 行の販売通貨。未指定（古い行・古い SELECT）の場合は 'JPY' フォールバック扱い。
   * price 列はこの通貨の最小単位 integer（JPY=yen, USD=cents）として扱う。
   */
  currency?: string | null
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

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

function computeApplicationFeeAmount(totalAmountMinor: number): number {
  // 規約の手数料率 15% を最小単位で適用（小数点以下は切り捨て）。
  // 入力は「販売通貨の最小単位 integer」（JPY=yen, USD=cents）。
  // 通貨非依存の integer 演算なので JPY/USD いずれも安全。
  return Math.floor(totalAmountMinor * SELLER_FEE_RATE)
}

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

export async function createCheckoutSession(skillId: string | number): Promise<CreateCheckoutSessionResult> {
  try {
    const normalizedSkillId = String(skillId ?? "").trim()
    if (!normalizedSkillId) {
      return { ok: false, error: "skillId is required" }
    }

    const { supabase, user } = await getAuthedSupabase()
    const supabaseAdmin = getSupabaseAdminClient()
    const stripe = getStripeClient()
    const appUrl = getAppBaseUrl()

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, title, user_id, price, currency")
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

    const reservationResult = await reserveSkillCheckoutSlot(supabaseAdmin, {
      skillId: skill.id,
      buyerId: user.id,
      sellerId: skill.user_id,
    })
    /** 事前ロックはベストエフォート。枠満杯・購入進行中でも Stripe へ進め、枠確保は Webhook の claim で最終判定する。 */
    const reservationId = reservationResult.ok ? reservationResult.reservationId : null

    /** Stripe セッション作成・attach まで完了したら true。それ以外は finally で reservationId があれば明示解放。 */
    let checkoutCommitted = false

    try {
      const amount = Math.max(0, Math.round(Number(skill.price)))
      if (amount < 1) {
        return { ok: false, error: "Invalid skill price" }
      }
      // 行の販売通貨を確定。未指定は 'JPY' フォールバック → 既存挙動と完全互換。
      const skillCurrency = normalizeCurrency(skill.currency)
      const stripeCurrencyCode = toStripeCurrencyCode(skillCurrency)
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

      /**
       * 決済完了後の取引確定は Webhook / finalize の claim に委ねる。
       * 講師口座への振込スケジュールはオンボーディング時に日次へ設定済み（`stripe.ts`）。
       *
       * 国際化対応:
       * - `locale: "auto"` … Checkout 画面の表示言語をブラウザ言語から自動判定（暗黙挙動と同じだが明示）
       * - `adaptive_pricing: { enabled: true }` … 海外の購入者向けに現地通貨での価格提示を有効化。
       *   ・JPY 出品: 売上計上・送金は引き続き JPY（settlement currency 不変）
       *   ・USD 出品: 課金通貨は USD、送金は連結口座の settlement currency へ Stripe が FX 自動変換
       *   ・Dashboard の Adaptive Pricing 設定が無効の場合は no-op（後方互換）
       *   ・参考: https://docs.stripe.com/payments/checkout/adaptive-pricing
       *
       * 多通貨対応:
       * - `currency` … 行の販売通貨を Stripe 形式（小文字 ISO 4217）で渡す。JPY なら "jpy"、USD なら "usd"
       * - `unit_amount` … 「販売通貨の最小単位 integer」をそのまま渡す（JPY=yen, USD=cents）
       * - `application_fee_amount` … 同じく最小単位。`currency` と同一通貨でなければ Stripe がエラー
       * - JP Connect 口座が USD 課金を受けると Stripe が cross-border charge として扱い、
       *   出品者の payout 時に FX 変換が発生する（手数料 ~2% 発生）。
       */
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        locale: "auto",
        adaptive_pricing: { enabled: true },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: stripeCurrencyCode,
              unit_amount: amount,
              product_data: {
                name: skill.title,
              },
            },
          },
        ],
        success_url: `${appUrl}/skills/${skill.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/skills/${skill.id}?checkout=cancel&session_id={CHECKOUT_SESSION_ID}`,
        payment_intent_data: {
          capture_method: "automatic",
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: sellerConnectAccountId,
          },
          metadata: {
            buyerId: user.id,
            payout_policy: "destination_charge_daily_schedule",
            platform_fee_amount: String(applicationFeeAmount),
            skill_id: skill.id,
            buyer_id: user.id,
            seller_id: skill.user_id,
            // currency と amount をスナップショット。後で finalize 側で取引行の currency に複製する。
            skill_currency: skillCurrency,
            amount_minor: String(amount),
            ...(reservationId ? { checkout_reservation_id: reservationId } : {}),
          },
        },
        metadata: {
          buyerId: user.id,
          skill_id: skill.id,
          buyer_id: user.id,
          seller_id: skill.user_id,
          amount: String(amount),
          // currency をスナップショット。後で finalize 側で取引行の currency に複製する。
          skill_currency: skillCurrency,
          ...(reservationId ? { checkout_reservation_id: reservationId } : {}),
        },
      })

      if (!session.url) {
        throw new Error("Failed to create checkout session URL")
      }

      if (reservationId) {
        await attachSkillCheckoutReservationSession(supabaseAdmin, {
          reservationId,
          checkoutSessionId: session.id,
        })
      }

      checkoutCommitted = true

      return {
        ok: true,
        url: session.url,
        checkoutSessionId: session.id,
      }
    } finally {
      if (!checkoutCommitted && reservationId) {
        await releaseSkillCheckoutReservationBestEffort(
          supabaseAdmin,
          { reservationId },
          "createCheckoutSession",
        )
      }
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

/**
 * Checkout の「戻る」で cancel_url に戻ったとき、未払いセッションの仮押さえを即解放する。
 * メタデータの buyer_id が現在ユーザーと一致する場合のみ（他者の session_id では解放しない）。
 */
export async function releaseCheckoutReservationAfterCancel(
  checkoutSessionId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = String(checkoutSessionId ?? "").trim()
  if (!normalized) {
    return { ok: false, error: "session_id is required" }
  }
  try {
    const { user } = await getAuthedSupabase()
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(normalized)
    const buyerId = session.metadata?.buyer_id?.trim()
    if (!buyerId || buyerId !== user.id) {
      return { ok: false, error: "この決済セッションを解放する権限がありません。" }
    }
    if (session.payment_status === "paid") {
      return { ok: true }
    }
    const supabaseAdmin = getSupabaseAdminClient()
    await releaseSkillCheckoutReservation(supabaseAdmin, { checkoutSessionId: normalized })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "仮押さえの解放に失敗しました。"
    console.error("[releaseCheckoutReservationAfterCancel]", { checkoutSessionId: normalized, message, error })
    return { ok: false, error: message }
  }
}

export async function finalizeCheckoutSessionAfterSuccess(
  checkoutSessionId: string | null | undefined,
): Promise<FinalizeCheckoutSessionResult> {
  const normalizedSessionId = String(checkoutSessionId ?? "").trim()
  if (!normalizedSessionId) {
    return { ok: false, error: "session_id is required" }
  }

  const supabaseAdmin = getSupabaseAdminClient()

  try {
    const { user } = await getAuthedSupabase()
    const stripe = getStripeClient()

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

    const paymentIntentId = await resolveStripePaymentIntentIdForCheckoutSession(stripe, session)
    const transactionIdMeta = session.metadata?.transaction_id?.trim() || null
    const checkoutReservationId = parseCheckoutReservationUuidFromMetadata(
      session.metadata?.checkout_reservation_id,
    )

    let claimResult: ClaimSkillApplicationAfterPaymentResult | null = null
    let lastClaimThrow: unknown = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        claimResult = await claimSkillApplicationAfterPayment(supabaseAdmin, {
          skillId,
          buyerId,
          sellerId,
          stripePaymentIntentId: paymentIntentId,
          targetTransactionId: transactionIdMeta,
          stripeCheckoutSessionId: normalizedSessionId,
          checkoutReservationId,
        })
        lastClaimThrow = null
        break
      } catch (e) {
        lastClaimThrow = e
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        }
      }
    }
    if (lastClaimThrow) {
      throw lastClaimThrow
    }
    if (!claimResult) {
      throw new Error("claim_skill_application_after_payment returned no result")
    }

    if (!claimResult.ok) {
      try {
        const refundResult = await refundPaidCheckoutSession(stripe, session)
        if (refundResult.created) {
          await notifyBuyerCheckoutRefunded({
            supabaseAdmin,
            buyerId,
            skillId,
            reason: claimResult.reason,
          })
        }
      } catch (refundError) {
        console.error("[finalizeCheckoutSessionAfterSuccess] refund after failed claim", {
          checkoutSessionId: normalizedSessionId,
          reason: claimResult.reason,
          message: refundError instanceof Error ? refundError.message : String(refundError),
        })
      }
      return {
        ok: false,
        error:
          claimResult.reason === "duplicate_payment"
            ? "重複した決済が検出されたため、自動返金されます。取引チャットをご確認ください。"
            : "申し込み枠が満杯のため、決済は自動返金されます。時間をおいて再度お試しください。",
      }
    }

    await ensureSellerPurchaseNotification({
      supabaseAdmin,
      transactionId: claimResult.row.transaction_id,
      sellerId,
      buyerId,
      skillId,
    })

    return {
      ok: true,
      transactionId: claimResult.row.transaction_id,
      status: claimResult.row.status,
    }
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
