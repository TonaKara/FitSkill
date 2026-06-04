import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { tryNotifyGritvibSubscriptionPurchaseDiscord } from "@/lib/purchase-notification"
import { resolveGritvibSubscriptionPeriodEndIso } from "@/lib/talk/stripe-subscription-period"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

/**
 * GritVib (人間チャットサービス) のサブスクと Supabase を同期するための Webhook ヘルパー群。
 *
 * 設計方針:
 *   - Stripe 側 Payment Link / Subscription の metadata に `service = "gritvib"` を埋め込む。
 *     これが付いている Stripe イベントだけ GritVib として処理する (japan-entry と同じ規約)。
 *   - 初回 `checkout.session.completed` で email → `auth.users.id` を解決し、
 *     `gritvib_chat_members` に `stripe_customer_id` を保存する。
 *   - 以降の `customer.subscription.updated` / `customer.subscription.deleted` は
 *     `stripe_customer_id` で逆引きして同期する。
 *   - `subscription_status` は Stripe の `subscription.status` をそのままミラーする
 *     (`active` / `trialing` / `past_due` / `canceled` / `incomplete` / `unpaid` / `paused`)。
 *   - 送信可否は DB 関数 `gritvib_chat_member_can_send` が `active` / `trialing` のみ true を
 *     返すので、status を素直に入れておけば送信制御は自動で噛み合う。
 */

export const GRITVIB_SERVICE_TAG = "gritvib" as const

/** `metadata.service === "gritvib"` を持つ Stripe オブジェクトか。 */
export function isGritvibServiceMetadata(
  metadata: Stripe.Metadata | null | undefined,
): boolean {
  if (!metadata) return false
  return metadata.service?.trim() === GRITVIB_SERVICE_TAG
}

/**
 * GritVib サブスクの Checkout Session か。
 * Payment Link の metadata に `service=gritvib` が無い場合の保険として、
 * 環境変数 `STRIPE_GRITVIB_PAYMENT_LINK_ID`（Stripe の `plink_...`）とも照合する。
 */
export function isGritvibCheckoutSession(session: Stripe.Checkout.Session): boolean {
  if (isGritvibServiceMetadata(session.metadata)) {
    return true
  }
  const configured = process.env.STRIPE_GRITVIB_PAYMENT_LINK_ID?.trim()
  if (!configured) {
    return false
  }
  const paymentLink = session.payment_link
  if (!paymentLink) {
    return false
  }
  const linkId = typeof paymentLink === "string" ? paymentLink : paymentLink.id
  return linkId === configured
}

function normalizeRpcUuid(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  return null
}

async function gritvibMemberExistsForEmail(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<boolean> {
  const { data: userIdData, error: rpcError } = await supabaseAdmin.rpc(
    "gritvib_resolve_user_id_by_email",
    { p_email: email },
  )
  if (rpcError) {
    logTalkServerError("[talk/stripe] resolve user_id for member check failed", {
      error: rpcError.message,
    })
    return false
  }
  const userId = normalizeRpcUuid(userIdData)
  if (!userId) return false

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle()

  if (memberError) {
    logTalkServerError("[talk/stripe] member lookup failed", { error: memberError.message })
    return false
  }
  return Boolean(memberRow?.nickname)
}

/**
 * Webhook で GritVib Checkout として処理すべきか。
 * metadata / Payment Link ID に加え、サブスク Checkout で会員メールが一致する場合も含める。
 */
export async function isGritvibCheckoutSessionForWebhook(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
): Promise<boolean> {
  if (isGritvibCheckoutSession(session)) {
    return true
  }
  if (session.mode !== "subscription") {
    return false
  }
  const email = await resolveCustomerEmail(stripe, session.customer, session.customer_email)
  if (!email) {
    return false
  }
  return gritvibMemberExistsForEmail(supabaseAdmin, email)
}

/** subscription.updated / deleted で GritVib 同期すべきか。 */
export async function shouldSyncGritvibSubscription(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
): Promise<boolean> {
  if (isGritvibServiceMetadata(subscription.metadata)) {
    return true
  }
  const customerId = resolveCustomerId(subscription.customer)
  if (!customerId) {
    return false
  }
  const { data: linked, error: linkedError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (linkedError) {
    logTalkServerError("[talk/stripe] linked member lookup failed", { error: linkedError.message })
    return false
  }
  if (linked?.id) {
    return true
  }
  const email = await resolveCustomerEmail(stripe, subscription.customer, null)
  if (!email) {
    return false
  }
  return gritvibMemberExistsForEmail(supabaseAdmin, email)
}

/**
 * Checkout Session の metadata を、生成された Subscription にも伝搬する。
 *
 * Stripe Payment Link の編集 UI には「Subscription metadata」を設定する項目が無いため、
 * Subscription に直接 metadata が乗らない。これが無いと `customer.subscription.updated`
 * / `deleted` のイベント時に GritVib のものか判定できない。
 *
 * 失敗しても throw しない (Webhook 全体を 500 にしないため)。
 */
export async function propagateGritvibMetadataToSubscription(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<void> {
  const subscriptionId = resolveSubscriptionId(session.subscription)
  if (!subscriptionId) return

  try {
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { service: GRITVIB_SERVICE_TAG },
    })
  } catch (error) {
    logTalkServerError("[talk/stripe] failed to propagate metadata to subscription", {
      subscriptionId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * 初回 `checkout.session.completed` で `gritvib_chat_members` を有効化する。
 *
 *   1. Stripe Customer (ID + email) を session から取り出す
 *   2. email → `auth.users.id` を SECURITY DEFINER 関数で解決
 *   3. `gritvib_chat_members.subscription_status` を Subscription の現状で更新
 *   4. `stripe_customer_id` を保存して以降の逆引き用キーにする
 */
export async function applyGritvibCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
): Promise<void> {
  const customerId = resolveCustomerId(session.customer)
  if (!customerId) {
    logTalkServerError("[talk/stripe] checkout session has no customer", { sessionId: session.id })
    return
  }
  const email = await resolveCustomerEmail(stripe, session.customer, session.customer_email)
  if (!email) {
    logTalkServerError("[talk/stripe] could not resolve customer email", {
      customerId,
      sessionId: session.id,
    })
    return
  }

  const { data: userIdData, error: rpcError } = await supabaseAdmin.rpc(
    "gritvib_resolve_user_id_by_email",
    { p_email: email },
  )
  if (rpcError) {
    logTalkServerError("[talk/stripe] resolve user_id rpc failed", {
      email,
      error: rpcError.message,
    })
    return
  }
  const userId = normalizeRpcUuid(userIdData)
  if (!userId) {
    /**
     * email が一致する Supabase Auth ユーザーがいない場合。
     * 例: ユーザーがメール確認をせずに Stripe の checkout だけ済ませた、
     *     あるいは Stripe 側で違うメールを入力した場合。
     * チャージは Stripe 側で受け付けているので、ここでは ERR ログだけ残す
     * (運用で個別対応する。リファンドはダッシュボードから行う)。
     */
    logTalkServerError("[talk/stripe] no matching user for stripe customer", { customerId })
    return
  }

  const { data: memberRow, error: memberFetchError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle()

  if (memberFetchError) {
    logTalkServerError("[talk/stripe] failed to fetch chat member before checkout update", {
      userId,
      error: memberFetchError.message,
    })
    return
  }
  if (!memberRow?.nickname) {
    logTalkServerError("[talk/stripe] chat member row missing for checkout", { userId, customerId })
    return
  }

  const { status: subscriptionStatus, currentPeriodEndIso } = await fetchSubscriptionState(
    stripe,
    session.subscription,
  )
  const resolvedStatus = subscriptionStatus ?? "active"

  const { error: updateError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .update({
      stripe_customer_id: customerId,
      subscription_status: resolvedStatus,
      subscription_current_period_end: currentPeriodEndIso,
    })
    .eq("id", userId)

  if (updateError) {
    logTalkServerError("[talk/stripe] failed to update chat_members on checkout completed", {
      userId,
      customerId,
      error: updateError.message,
    })
    return
  }

  /** Discord は best-effort。失敗しても Webhook / DB 更新には影響しない。 */
  void tryNotifyGritvibSubscriptionPurchaseDiscord({
    nickname: memberRow.nickname,
    email,
    userId,
    subscriptionStatus: resolvedStatus,
    stripeCustomerId: customerId,
    stripeSessionId: session.id,
  })
}

/**
 * `customer.subscription.updated` / `customer.subscription.deleted` の共通ハンドラ。
 *
 * Stripe Subscription の `status` と `current_period_end` をそのまま同期するだけ。
 * `deleted` 時は `status='canceled'` が来るので、特別扱いは不要。
 *
 * 逆引きキーは `stripe_customer_id`。checkout 完了時に保存していなければ no-op。
 */
export async function applyGritvibSubscriptionSync(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
): Promise<void> {
  const customerId = resolveCustomerId(subscription.customer)
  if (!customerId) {
    logTalkServerError("[talk/stripe] subscription has no customer", {
      subscriptionId: subscription.id,
    })
    return
  }
  const currentPeriodEndIso = resolveGritvibSubscriptionPeriodEndIso(subscription)
  const patch = {
    subscription_status: subscription.status,
    subscription_current_period_end: currentPeriodEndIso,
    stripe_customer_id: customerId,
  }

  const { data: byCustomer, error: byCustomerError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .update(patch)
    .eq("stripe_customer_id", customerId)
    .select("id")

  if (byCustomerError) {
    logTalkServerError("[talk/stripe] failed to sync subscription state by customer", {
      customerId,
      subscriptionId: subscription.id,
      error: byCustomerError.message,
    })
    return
  }
  if (byCustomer?.length) {
    return
  }

  const email = await resolveCustomerEmail(stripe, subscription.customer, null)
  if (!email) {
    logTalkServerError("[talk/stripe] subscription sync skipped: no customer email", {
      customerId,
      subscriptionId: subscription.id,
    })
    return
  }

  const { data: userIdData, error: rpcError } = await supabaseAdmin.rpc(
    "gritvib_resolve_user_id_by_email",
    { p_email: email },
  )
  if (rpcError) {
    logTalkServerError("[talk/stripe] subscription sync resolve user failed", {
      email,
      error: rpcError.message,
    })
    return
  }
  const userId = normalizeRpcUuid(userIdData)
  if (!userId) {
    return
  }

  const { error: byUserError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .update(patch)
    .eq("id", userId)

  if (byUserError) {
    logTalkServerError("[talk/stripe] failed to sync subscription state by user", {
      userId,
      customerId,
      subscriptionId: subscription.id,
      error: byUserError.message,
    })
  }
}

/** ----------------------------------------------------------
 *  内部ユーティリティ
 * ---------------------------------------------------------- */

function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null
  if (typeof customer === "string") return customer
  return customer.id ?? null
}

function resolveSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!subscription) return null
  if (typeof subscription === "string") return subscription
  return subscription.id ?? null
}

/**
 * Checkout session から email を解決する。
 * - `session.customer_email` が来ていればそれを優先 (Payment Link で必ず付く)
 * - 無ければ Stripe Customer を retrieve して email を取り出す
 */
async function resolveCustomerEmail(
  stripe: Stripe,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
  fallback: string | null,
): Promise<string | null> {
  const direct = (fallback ?? "").trim().toLowerCase()
  if (direct) return direct

  const id = resolveCustomerId(customer)
  if (!id) return null
  try {
    const c = await stripe.customers.retrieve(id)
    if (c && !("deleted" in c) && c.email) {
      return c.email.trim().toLowerCase()
    }
  } catch (error) {
    logTalkServerError("[talk/stripe] failed to retrieve customer email", {
      customerId: id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return null
}

async function fetchSubscriptionState(
  stripe: Stripe,
  subscription: string | Stripe.Subscription | null | undefined,
): Promise<{ status: Stripe.Subscription.Status | null; currentPeriodEndIso: string | null }> {
  const id = resolveSubscriptionId(subscription)
  if (!id) {
    return { status: null, currentPeriodEndIso: null }
  }
  try {
    const sub = await stripe.subscriptions.retrieve(id)
    return {
      status: sub.status,
      currentPeriodEndIso: resolveGritvibSubscriptionPeriodEndIso(sub),
    }
  } catch (error) {
    logTalkServerError("[talk/stripe] failed to retrieve subscription state", {
      subscriptionId: id,
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: null, currentPeriodEndIso: null }
  }
}
