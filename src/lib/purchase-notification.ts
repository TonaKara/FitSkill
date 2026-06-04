import type { SupabaseClient } from "@supabase/supabase-js"
import { sendDiscordNotification } from "@/lib/discord"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl, getSiteUrl } from "@/lib/site-seo"

export type CheckoutRefundReason = "skill_full" | "duplicate_payment"

/** スキル購入・GritVib サブスク購入など、運営向け「新規購入」Discord 通知の Webhook。 */
export function resolvePurchaseDiscordWebhookUrl(): string {
  return process.env.DISCORD_WEBHOOK_PURCHASE?.trim() ?? ""
}

/**
 * `DISCORD_WEBHOOK_PURCHASE` への通知 (best-effort)。
 * 未設定・送信失敗時も throw しない。
 */
export async function trySendPurchaseDiscordNotification(message: string): Promise<void> {
  const webhookUrl = resolvePurchaseDiscordWebhookUrl()
  if (!webhookUrl) return

  try {
    await sendDiscordNotification(webhookUrl, message)
  } catch (discordError) {
    console.error("[purchase-notification] discord purchase notification failed", discordError)
  }
}

export type GritvibSubscriptionPurchaseDiscordPayload = {
  nickname: string
  email: string
  userId: string
  subscriptionStatus: string
  stripeCustomerId: string
  stripeSessionId: string
}

function describeGritvibSubscriptionStatus(status: string): string {
  switch (status) {
    case "active":
      return "有効"
    case "trialing":
      return "トライアル中"
    case "past_due":
      return "支払期限超過"
    case "canceled":
      return "解約済み"
    case "incomplete":
      return "未完了"
    case "incomplete_expired":
      return "未完了 (期限切れ)"
    case "unpaid":
      return "未払い"
    case "paused":
      return "一時停止"
    case "inactive":
      return "未加入"
    default:
      return status
  }
}

/** GritVib サブスク購入時の Discord 通知（`DISCORD_WEBHOOK_PURCHASE` を流用）。 */
export async function tryNotifyGritvibSubscriptionPurchaseDiscord(
  payload: GritvibSubscriptionPurchaseDiscordPayload,
): Promise<void> {
  const nickname = payload.nickname.trim() || "（不明）"
  const email = payload.email.trim() || "（不明）"
  const statusLabel = describeGritvibSubscriptionStatus(payload.subscriptionStatus.trim())
  const baseUrl = getSiteUrl().replace(/\/$/, "")
  const adminUrl = `${baseUrl}/talk/admin`

  await trySendPurchaseDiscordNotification(
    [
      "@everyone",
      "💳 **新規購入（GritVib サブスク）**",
      `- ニックネーム: ${nickname}`,
      `- メール: ${email}`,
      `- ステータス: ${statusLabel}`,
      `- 会員 ID: ${payload.userId}`,
      `- Stripe Customer: ${payload.stripeCustomerId}`,
      `- Checkout Session: ${payload.stripeSessionId}`,
      `- 管理画面: ${adminUrl}`,
    ].join("\n"),
  )
}

export async function notifyBuyerCheckoutRefunded(params: {
  supabaseAdmin: SupabaseClient
  buyerId: string
  skillId: string
  reason: CheckoutRefundReason
}) {
  const { supabaseAdmin, buyerId, skillId, reason } = params
  const { data: skillRow } = await supabaseAdmin.from("skills").select("title").eq("id", skillId).maybeSingle()
  const skillTitle = ((skillRow as { title?: string | null } | null)?.title ?? "").trim() || skillId
  const skillUrl = `${getAppBaseUrl()}/skills/${encodeURIComponent(skillId)}`
  const intro =
    reason === "duplicate_payment"
      ? "同一スキルに対する重複したお支払いを検出したため、今回の決済は自動返金しました。"
      : "申し込み枠の確保に失敗したため、今回のお支払いは自動返金しました。"

  await sendUserEventEmail({
    topic: "checkout_refund",
    userId: buyerId,
    subject: "【GritVib】お支払いが返金されました",
    heading: "返金のお知らせ",
    intro,
    lines: [
      `対象スキル: ${skillTitle}`,
      "返金の反映には、カード会社や決済サービスの処理により数日かかる場合があります。",
    ],
    ctaLabel: "スキルページを開く",
    ctaUrl: skillUrl,
    localizedKeys: {
      subjectKey: "email.checkoutRefund.subject",
      headingKey: "email.checkoutRefund.heading",
      introKey:
        reason === "duplicate_payment"
          ? "email.checkoutRefund.introDuplicate"
          : "email.checkoutRefund.introSkillFull",
      lineKeys: ["email.checkoutRefund.lineSkill", "email.checkoutRefund.lineDelay"],
      ctaLabelKey: "email.checkoutRefund.cta",
      values: { title: skillTitle },
    },
  })
}

export async function ensureSellerPurchaseNotification(params: {
  supabaseAdmin: SupabaseClient
  transactionId: string
  sellerId: string
  buyerId: string
  skillId: string
}) {
  const { supabaseAdmin, transactionId, sellerId, buyerId, skillId } = params

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

  const [{ data: buyerProfile }, { data: sellerProfile }, { data: skillRow }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").eq("id", buyerId).maybeSingle(),
    supabaseAdmin.from("profiles").select("display_name").eq("id", sellerId).maybeSingle(),
    supabaseAdmin.from("skills").select("title").eq("id", skillId).maybeSingle(),
  ])
  const buyerName =
    ((buyerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || buyerId
  const sellerName =
    ((sellerProfile as { display_name?: string | null } | null)?.display_name ?? "").trim() || sellerId
  const skillTitle = ((skillRow as { title?: string | null } | null)?.title ?? "").trim() || skillId
  const baseUrl = getSiteUrl().replace(/\/$/, "")
  const chatUrl = `${baseUrl}/chat/${encodeURIComponent(transactionId)}`
  const adminUrl = `${baseUrl}/admin`
  await trySendPurchaseDiscordNotification(
    [
      "🛒 **取引開始（購入）**",
      `- 購入者: ${buyerName}`,
      `- 講師: ${sellerName}`,
      `- 商品: ${skillTitle}`,
      `- 取引チャット: ${chatUrl}`,
      `- 管理画面: ${adminUrl}`,
    ].join("\n"),
  )

  const appChatUrl = `${getAppBaseUrl()}/chat/${encodeURIComponent(transactionId)}`
  await Promise.all([
    sendUserEventEmail({
      topic: "transaction_established",
      userId: sellerId,
      subject: "【GritVib】取引が成立しました",
      heading: "取引成立通知",
      intro: "あなたのスキルが購入され、取引が開始されました。",
      ctaLabel: "取引チャットを開く",
      ctaUrl: appChatUrl,
      localizedKeys: {
        subjectKey: "email.transactionEstablished.subject",
        headingKey: "email.transactionEstablished.heading",
        introKey: "email.transactionEstablished.introSeller",
        ctaLabelKey: "email.transactionEstablished.cta",
      },
    }),
    sendUserEventEmail({
      topic: "transaction_established",
      userId: buyerId,
      subject: "【GritVib】取引が成立しました",
      heading: "取引成立通知",
      intro: "購入手続きが完了し、取引が開始されました。",
      ctaLabel: "取引チャットを開く",
      ctaUrl: appChatUrl,
      localizedKeys: {
        subjectKey: "email.transactionEstablished.subject",
        headingKey: "email.transactionEstablished.heading",
        introKey: "email.transactionEstablished.introBuyer",
        ctaLabelKey: "email.transactionEstablished.cta",
      },
    }),
  ])
}
