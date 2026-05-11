import type { SupabaseClient } from "@supabase/supabase-js"
import { sendDiscordNotification } from "@/lib/discord"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl, getSiteUrl } from "@/lib/site-seo"

export type CheckoutRefundReason = "skill_full" | "duplicate_payment"

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

  const webhookUrl = process.env.DISCORD_WEBHOOK_PURCHASE?.trim() ?? ""
  if (webhookUrl) {
    try {
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
      await sendDiscordNotification(
        webhookUrl,
        [
          "🛒 **取引開始（購入）**",
          `- 購入者: ${buyerName}`,
          `- 講師: ${sellerName}`,
          `- 商品: ${skillTitle}`,
          `- 取引チャット: ${chatUrl}`,
          `- 管理画面: ${adminUrl}`,
        ].join("\n"),
      )
    } catch (discordError) {
      console.error("[purchase-notification] discord purchase notification failed", discordError)
    }
  }

  const chatUrl = `${getAppBaseUrl()}/chat/${encodeURIComponent(transactionId)}`
  await Promise.all([
    sendUserEventEmail({
      topic: "transaction_established",
      userId: sellerId,
      subject: "【GritVib】取引が成立しました",
      heading: "取引成立通知",
      intro: "あなたのスキルが購入され、取引が開始されました。",
      ctaLabel: "取引チャットを開く",
      ctaUrl: chatUrl,
    }),
    sendUserEventEmail({
      topic: "transaction_established",
      userId: buyerId,
      subject: "【GritVib】取引が成立しました",
      heading: "取引成立通知",
      intro: "購入手続きが完了し、取引が開始されました。",
      ctaLabel: "取引チャットを開く",
      ctaUrl: chatUrl,
    }),
  ])
}
