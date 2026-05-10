/**
 * イベントに応じた **メール（Resend）** のみを送る API。
 * アプリ内 `notifications` は呼び出し元で作成済みであること（設定のオンオフはメールにのみ適用）。
 */
import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl } from "@/lib/site-seo"

type Body = {
  event?:
    | "consultation_received"
    | "consultation_decision"
    | "transaction_established"
    | "transaction_message"
    | "transaction_completed"
    | "completion_requested"
    | "dispute_result"
    | "user_banned"
    | "skill_moderated"
  answerId?: string
  decision?: "accepted" | "rejected"
  transactionId?: string
  result?: "approved" | "rejected"
  targetUserId?: string
  reason?: string
  skillId?: string
  action?: "unpublished" | "deleted"
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function isAdminUser(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
  return (data as { is_admin?: boolean | null } | null)?.is_admin === true
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }
    const supabaseAdmin = getSupabaseAdminClient()
    if (!supabaseAdmin) {
      return Response.json({ ok: true, skipped: "mail_service_not_configured" })
    }
    const { user } = auth.context
    const body = (await req.json()) as Body
    const event = String(body.event ?? "").trim()
    const appUrl = getAppBaseUrl()

    if (event === "consultation_received") {
      const answerId = String(body.answerId ?? "").trim()
      if (!answerId) return Response.json({ error: "answerId is required" }, { status: 400 })
      const { data } = await supabaseAdmin
        .from("consultation_answers")
        .select("id, buyer_id, seller_id, skill_id")
        .eq("id", answerId)
        .maybeSingle()
      const answer = data as { buyer_id?: string; seller_id?: string; skill_id?: number | string } | null
      if (!answer || answer.buyer_id !== user.id) return Response.json({ error: "forbidden" }, { status: 403 })
      await sendUserEventEmail({
        topic: "consultation_offer",
        userId: String(answer.seller_id ?? ""),
        subject: "【GritVib】新しい事前オファーが届きました",
        heading: "事前オファー通知",
        intro: "あなたのスキルに新しい事前オファーが届きました。",
        lines: ["マイページの受講リクエストから内容を確認し、承認または拒否を選択してください。"],
        ctaLabel: "受講リクエストを確認",
        ctaUrl: `${appUrl}/mypage?section=requests`,
      })
      return Response.json({ ok: true })
    }

    if (event === "consultation_decision") {
      const answerId = String(body.answerId ?? "").trim()
      const decision = body.decision
      if (!answerId || (decision !== "accepted" && decision !== "rejected")) {
        return Response.json({ error: "invalid payload" }, { status: 400 })
      }
      const { data } = await supabaseAdmin
        .from("consultation_answers")
        .select("id, buyer_id, seller_id, skill_id, status")
        .eq("id", answerId)
        .maybeSingle()
      const answer = data as { buyer_id?: string; seller_id?: string; skill_id?: number | string; status?: string } | null
      if (!answer || answer.seller_id !== user.id) return Response.json({ error: "forbidden" }, { status: 403 })
      await sendUserEventEmail({
        topic: "consultation_decision",
        userId: String(answer.buyer_id ?? ""),
        subject: `【GritVib】事前オファーが${decision === "accepted" ? "承認" : "拒否"}されました`,
        heading: `事前オファー${decision === "accepted" ? "承認" : "拒否"}通知`,
        intro:
          decision === "accepted"
            ? "事前オファーが承認されました。購入手続きに進めます。"
            : "事前オファーが拒否されました。必要があれば内容を見直して再申請してください。",
        ctaLabel: "マイページを開く",
        ctaUrl: `${appUrl}/mypage?section=requests`,
      })
      return Response.json({ ok: true })
    }

    if (event === "transaction_message") {
      const transactionId = String(body.transactionId ?? "").trim()
      if (!transactionId) return Response.json({ error: "transactionId is required" }, { status: 400 })
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle()
      const tx = data as { buyer_id?: string; seller_id?: string } | null
      if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 })
      if (user.id !== tx.buyer_id && user.id !== tx.seller_id) return Response.json({ error: "forbidden" }, { status: 403 })
      const recipientId = user.id === tx.buyer_id ? String(tx.seller_id ?? "") : String(tx.buyer_id ?? "")
      await sendUserEventEmail({
        topic: "transaction_chat",
        userId: recipientId,
        subject: "【GritVib】取引チャットに新しいメッセージが届きました",
        heading: "取引チャット通知",
        intro: "取引チャットに新しいメッセージが届いています。",
        ctaLabel: "チャットを開く",
        ctaUrl: `${appUrl}/chat/${encodeURIComponent(transactionId)}`,
      })
      return Response.json({ ok: true })
    }

    if (event === "transaction_established") {
      const transactionId = String(body.transactionId ?? "").trim()
      if (!transactionId) return Response.json({ error: "transactionId is required" }, { status: 400 })
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle()
      const tx = data as { buyer_id?: string; seller_id?: string } | null
      if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 })
      if (user.id !== tx.buyer_id && user.id !== tx.seller_id) return Response.json({ error: "forbidden" }, { status: 403 })
      const chatUrl = `${appUrl}/chat/${encodeURIComponent(transactionId)}`
      await Promise.all([
        sendUserEventEmail({
          topic: "transaction_established",
          userId: String(tx.seller_id ?? ""),
          subject: "【GritVib】取引が成立しました",
          heading: "取引成立通知",
          intro: "あなたのスキルが購入され、取引が開始されました。",
          ctaLabel: "取引チャットを開く",
          ctaUrl: chatUrl,
        }),
        sendUserEventEmail({
          topic: "transaction_established",
          userId: String(tx.buyer_id ?? ""),
          subject: "【GritVib】取引が成立しました",
          heading: "取引成立通知",
          intro: "購入手続きが完了し、取引が開始されました。",
          ctaLabel: "取引チャットを開く",
          ctaUrl: chatUrl,
        }),
      ])
      return Response.json({ ok: true })
    }

    if (event === "completion_requested") {
      const transactionId = String(body.transactionId ?? "").trim()
      if (!transactionId) return Response.json({ error: "transactionId is required" }, { status: 400 })
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle()
      const tx = data as { buyer_id?: string; seller_id?: string } | null
      if (!tx || user.id !== tx.seller_id) return Response.json({ error: "forbidden" }, { status: 403 })
      await sendUserEventEmail({
        topic: "completion_request",
        userId: String(tx.buyer_id ?? ""),
        subject: "【GritVib】取引完了申請が届きました",
        heading: "取引完了申請通知",
        intro: "出品者から取引完了申請が届きました。内容を確認して承認してください。",
        ctaLabel: "取引チャットを確認",
        ctaUrl: `${appUrl}/chat/${encodeURIComponent(transactionId)}`,
      })
      return Response.json({ ok: true })
    }

    if (event === "transaction_completed") {
      const transactionId = String(body.transactionId ?? "").trim()
      if (!transactionId) return Response.json({ error: "transactionId is required" }, { status: 400 })
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle()
      const tx = data as { buyer_id?: string; seller_id?: string } | null
      if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 })
      if (user.id !== tx.buyer_id && user.id !== tx.seller_id) {
        const admin = await isAdminUser(supabaseAdmin, user.id)
        if (!admin) return Response.json({ error: "forbidden" }, { status: 403 })
      }
      const chatUrl = `${appUrl}/chat/${encodeURIComponent(transactionId)}`
      await Promise.all([
        sendUserEventEmail({
          topic: "transaction_completed",
          userId: String(tx.buyer_id ?? ""),
          subject: "【GritVib】取引が完了しました",
          heading: "取引完了通知",
          intro: "対象の取引は完了しました。",
          ctaLabel: "取引チャットを開く",
          ctaUrl: chatUrl,
        }),
        sendUserEventEmail({
          topic: "transaction_completed",
          userId: String(tx.seller_id ?? ""),
          subject: "【GritVib】取引が完了しました",
          heading: "取引完了通知",
          intro: "対象の取引は完了しました。",
          ctaLabel: "取引チャットを開く",
          ctaUrl: chatUrl,
        }),
      ])
      return Response.json({ ok: true })
    }

    if (event === "dispute_result") {
      const transactionId = String(body.transactionId ?? "").trim()
      const result = body.result
      if (!transactionId || (result !== "approved" && result !== "rejected")) {
        return Response.json({ error: "invalid payload" }, { status: 400 })
      }
      const admin = await isAdminUser(supabaseAdmin, user.id)
      if (!admin) return Response.json({ error: "forbidden" }, { status: 403 })
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("id, buyer_id, seller_id")
        .eq("id", transactionId)
        .maybeSingle()
      const tx = data as { buyer_id?: string; seller_id?: string } | null
      if (!tx) return Response.json({ error: "transaction not found" }, { status: 404 })
      const subject =
        result === "approved"
          ? "【GritVib】異議申し立てが承認されました"
          : "【GritVib】異議申し立てが棄却されました"
      const intro =
        result === "approved"
          ? "異議申し立てが承認され、取引は再開されました。"
          : "異議申し立ては棄却され、取引は完了しました。"
      await Promise.all([
        sendUserEventEmail({
          topic: "dispute_result",
          userId: String(tx.buyer_id ?? ""),
          subject,
          heading: "異議申し立て結果通知",
          intro,
          ctaLabel: "取引チャットを確認",
          ctaUrl: `${appUrl}/chat/${encodeURIComponent(transactionId)}`,
        }),
        sendUserEventEmail({
          topic: "dispute_result",
          userId: String(tx.seller_id ?? ""),
          subject,
          heading: "異議申し立て結果通知",
          intro,
          ctaLabel: "取引チャットを確認",
          ctaUrl: `${appUrl}/chat/${encodeURIComponent(transactionId)}`,
        }),
      ])
      return Response.json({ ok: true })
    }

    if (event === "user_banned") {
      const targetUserId = String(body.targetUserId ?? "").trim()
      const reason = String(body.reason ?? "").trim()
      if (!targetUserId) return Response.json({ error: "targetUserId is required" }, { status: 400 })
      const admin = await isAdminUser(supabaseAdmin, user.id)
      if (!admin) return Response.json({ error: "forbidden" }, { status: 403 })
      await sendUserEventEmail({
        topic: "account_notice",
        userId: targetUserId,
        subject: "【GritVib】アカウント利用制限のお知らせ",
        heading: "アカウント利用制限通知",
        intro: "運営判断により、あなたのアカウントは利用停止（BAN）されました。",
        lines: reason ? [`理由: ${reason}`] : [],
        ctaLabel: "お問い合わせ",
        ctaUrl: `${appUrl}/contact`,
      })
      return Response.json({ ok: true })
    }

    if (event === "skill_moderated") {
      const skillId = String(body.skillId ?? "").trim()
      const action = body.action
      const reason = String(body.reason ?? "").trim()
      if (!skillId || (action !== "unpublished" && action !== "deleted")) {
        return Response.json({ error: "invalid payload" }, { status: 400 })
      }
      const admin = await isAdminUser(supabaseAdmin, user.id)
      if (!admin) return Response.json({ error: "forbidden" }, { status: 403 })
      const { data } = await supabaseAdmin.from("skills").select("id, user_id, title").eq("id", skillId).maybeSingle()
      const skill = data as { user_id?: string | null; title?: string | null; id?: string | number } | null
      if (!skill?.user_id) return Response.json({ error: "skill owner not found" }, { status: 404 })
      await sendUserEventEmail({
        topic: "account_notice",
        userId: skill.user_id,
        subject: `【GritVib】商品が${action === "deleted" ? "削除" : "非公開"}されました`,
        heading: "商品モデレーション通知",
        intro: `運営対応により商品「${skill.title?.trim() || String(skill.id)}」が${action === "deleted" ? "削除" : "非公開"}されました。`,
        lines: reason ? [`理由: ${reason}`] : [],
        ctaLabel: "マイページを開く",
        ctaUrl: `${appUrl}/mypage?section=listings`,
      })
      return Response.json({ ok: true })
    }

    return Response.json({ error: "unsupported event" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send event email"
    return Response.json({ error: message }, { status: 500 })
  }
}
