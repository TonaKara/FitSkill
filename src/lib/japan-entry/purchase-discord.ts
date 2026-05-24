import type Stripe from "stripe"
import { sendDiscordNotification } from "@/lib/discord"

/**
 * Japan Entry Support の Stripe Payment Link / Subscription に仕込む metadata の規約。
 * - `service`: 必ず "japan_entry" を入れる（既存の Skill 取引と区別する識別子）
 * - `plan`: 下記 4 値のいずれか
 *
 * これらは Stripe Dashboard で各 Payment Link 編集時に手動で設定する。
 * Subscription プラン（standard / premium）は "Subscription metadata" にも
 * 同じ key/value を入れること（解約通知で参照するため）。
 */
const JES_SERVICE_TAG = "japan_entry" as const

type JapanEntryPlanKey = "alacarte_post" | "alacarte_legal" | "standard" | "premium"

const PLAN_DISPLAY_MAP: Record<JapanEntryPlanKey, { name: string; pricing: string }> = {
  alacarte_post: { name: "A La Carte: Single Post Translation", pricing: "$30 (one-time)" },
  alacarte_legal: { name: "A La Carte: Legal & Compliance Pack", pricing: "$399 (one-time)" },
  standard: { name: "Standard", pricing: "$499 / month" },
  premium: { name: "Premium", pricing: "$899 / month" },
}

function isJapanEntryPlanKey(value: string | null | undefined): value is JapanEntryPlanKey {
  return value === "alacarte_post" || value === "alacarte_legal" || value === "standard" || value === "premium"
}

/**
 * `metadata.service === "japan_entry"` を持つ Stripe オブジェクトかどうか。
 * Webhook ハンドラ側で先に判定して既存の Skill 取引フローに流し込まないために使う。
 */
export function isJapanEntryServiceMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  if (!metadata) {
    return false
  }
  return metadata.service?.trim() === JES_SERVICE_TAG
}

function resolveJapanEntryDiscordWebhookUrl(): string {
  return (process.env.DISCORD_WEBHOOK_JAPAN_ENTRY ?? "").trim()
}

function describePlan(planKey: string | null | undefined): { name: string; pricing: string } {
  if (isJapanEntryPlanKey(planKey)) {
    return PLAN_DISPLAY_MAP[planKey]
  }
  if (planKey) {
    return { name: `Unknown plan (${planKey})`, pricing: "" }
  }
  return { name: "（plan メタデータ未設定）", pricing: "" }
}

function formatAmount(amountTotal: number | null | undefined, currency: string | null | undefined): string {
  if (amountTotal === null || amountTotal === undefined || !currency) {
    return "（不明）"
  }
  /** Stripe は最小通貨単位（USD なら cent）で金額を返す。表示は major unit に変換する。 */
  const major = (amountTotal / 100).toFixed(2)
  return `${major} ${currency.toUpperCase()}`
}

function safeText(value: string | null | undefined, fallback = "（不明）"): string {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) {
    return null
  }
  if (typeof customer === "string") {
    return customer
  }
  return customer.id ?? null
}

function buildCustomerDashboardUrl(customerId: string | null, fallbackPath: string): string {
  if (customerId) {
    return `https://dashboard.stripe.com/customers/${customerId}`
  }
  return `https://dashboard.stripe.com${fallbackPath}`
}

function describeMode(mode: Stripe.Checkout.Session["mode"] | null | undefined): string {
  if (mode === "subscription") return "Subscription"
  if (mode === "payment") return "One-time"
  if (mode === "setup") return "Setup"
  return mode ?? "unknown"
}

/**
 * Checkout Session の metadata を、生成された Subscription にも伝搏する。
 *
 * Stripe Payment Link の編集 UI には「Subscription metadata」を設定する項目が無いため、
 * Subscription に直接 metadata が乗らない。これがないと `customer.subscription.deleted`
 * イベント時に「JES の解約か」を判定できない。
 *
 * 解決策として、Webhook で `checkout.session.completed` を受けたタイミングで、
 * Stripe API 経由で Subscription に同じ metadata（service / plan）を書き込む。
 *
 * - One-time payment の session（`session.subscription` が無い）はスキップ
 * - service / plan が読めなければスキップ（メタデータ未設定の Payment Link 対策）
 * - API 失敗は throw しない（通知本体まで巻き込んで Webhook を 500 にしない）
 */
export async function propagateJapanEntryMetadataToSubscription(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null
  if (!subscriptionId) {
    return
  }

  const service = session.metadata?.service?.trim()
  const plan = session.metadata?.plan?.trim()
  if (!service || !plan) {
    console.warn(
      "[japan-entry] checkout session metadata missing service/plan; skip subscription propagation",
      { sessionId: session.id },
    )
    return
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        service,
        plan,
      },
    })
  } catch (error) {
    console.error("[japan-entry] failed to propagate metadata to subscription", {
      subscriptionId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Checkout 完了時の購入通知を Discord に送信する。
 * - 失敗しても throw しない（Webhook 側で 200 を返したいため）
 * - DISCORD_WEBHOOK_JAPAN_ENTRY 未設定時は warn ログを出して何もしない
 */
export async function notifyJapanEntryPurchaseToDiscord(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const webhookUrl = resolveJapanEntryDiscordWebhookUrl()
  if (!webhookUrl) {
    console.warn("[japan-entry] DISCORD_WEBHOOK_JAPAN_ENTRY is not set; skip purchase notify")
    return
  }

  const planKey = session.metadata?.plan?.trim() ?? null
  const plan = describePlan(planKey)
  const customerEmail = safeText(
    session.customer_details?.email ?? session.customer_email,
  )
  const customerName = safeText(session.customer_details?.name)
  const customerId = getStripeCustomerId(session.customer)
  const mode = describeMode(session.mode)
  const amount = formatAmount(session.amount_total, session.currency)
  const dashboardUrl = buildCustomerDashboardUrl(
    customerId,
    `/checkout/sessions/${session.id}`,
  )

  const message = [
    "@everyone",
    "🎉 **Japan Entry Support — 新規購入**",
    `- プラン: ${plan.name}${plan.pricing ? ` (${plan.pricing})` : ""}`,
    `- 顧客名: ${customerName}`,
    `- メール: ${customerEmail}`,
    `- 金額: ${amount}`,
    `- 種別: ${mode}`,
    `- Stripe Session: ${session.id}`,
    customerId ? `- Stripe Customer: ${customerId}` : "- Stripe Customer: （未生成）",
    `- 管理画面: ${dashboardUrl}`,
  ].join("\n")

  try {
    await sendDiscordNotification(webhookUrl, message)
  } catch (error) {
    console.error("[japan-entry] purchase discord notify failed", error)
  }
}

/**
 * サブスク解約イベント（customer.subscription.deleted）の通知を Discord に送信する。
 * - subscription オブジェクトには直接 email/name が含まれないため、必要なら customer を取得する
 * - customer 取得失敗・未設定時は ID のみで通知する（リトライさせない方が望ましい）
 * - 失敗しても throw しない（Webhook 側で 200 を返したいため）
 */
export async function notifyJapanEntrySubscriptionCanceledToDiscord(
  subscription: Stripe.Subscription,
  stripe: Stripe,
): Promise<void> {
  const webhookUrl = resolveJapanEntryDiscordWebhookUrl()
  if (!webhookUrl) {
    console.warn("[japan-entry] DISCORD_WEBHOOK_JAPAN_ENTRY is not set; skip cancel notify")
    return
  }

  const planKey = subscription.metadata?.plan?.trim() ?? null
  const plan = describePlan(planKey)
  const customerId = getStripeCustomerId(subscription.customer)

  let customerEmail = "（不明）"
  let customerName = "（不明）"
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!customer.deleted) {
        customerEmail = safeText(customer.email)
        customerName = safeText(customer.name)
      }
    } catch (error) {
      console.warn("[japan-entry] failed to retrieve customer for cancel notify", error)
    }
  }

  const canceledAtIso = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString()
  const dashboardUrl = buildCustomerDashboardUrl(
    customerId,
    `/subscriptions/${subscription.id}`,
  )

  const cancelReason = safeText(subscription.cancellation_details?.reason, "（理由未記録）")

  const message = [
    "@everyone",
    "⚠️ **Japan Entry Support — サブスク解約**",
    `- プラン: ${plan.name}`,
    `- 顧客名: ${customerName}`,
    `- メール: ${customerEmail}`,
    `- 解約日時: ${canceledAtIso} (UTC)`,
    `- 解約理由: ${cancelReason}`,
    `- Stripe Subscription: ${subscription.id}`,
    customerId ? `- Stripe Customer: ${customerId}` : "- Stripe Customer: （未取得）",
    `- 管理画面: ${dashboardUrl}`,
  ].join("\n")

  try {
    await sendDiscordNotification(webhookUrl, message)
  } catch (error) {
    console.error("[japan-entry] cancel discord notify failed", error)
  }
}
