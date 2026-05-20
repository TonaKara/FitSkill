import { render } from "@react-email/render"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { requireApiUser } from "@/lib/api-auth"
import {
  parseEmailNotificationSettings,
  shouldSendEmailForTopic,
} from "@/lib/email-notification-settings"
import { formatMessage, getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/lib/i18n/locales"
import { getAppBaseUrl } from "@/lib/site-seo"
import InquiryMessageEmail from "../../../../src/emails/InquiryMessageEmail"

function getAdminSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return null
  }
  return new Resend(key)
}

type RequestBody = { messageId?: string }

function trimSnippet(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const { messageId } = (await req.json()) as RequestBody
    const id = String(messageId ?? "").trim()
    if (!id) {
      return Response.json({ error: "messageId is required" }, { status: 400 })
    }

    const { supabase, user } = auth.context
    const { data: msgData, error: msgErr } = await supabase
      .from("inquiry_messages")
      .select("id, sender_id, recipient_id, origin_skill_id, content")
      .eq("id", id)
      .maybeSingle()

    const msg = msgData as
      | {
          id: string
          sender_id: string
          recipient_id: string
          origin_skill_id: string | number
          content: string
        }
      | null

    if (msgErr || !msg) {
      return Response.json({ error: "message not found" }, { status: 404 })
    }
    if (msg.sender_id !== user.id) {
      return Response.json({ error: "forbidden" }, { status: 403 })
    }

    const admin = getAdminSupabaseClient()
    const resend = getResendClient()
    if (!admin || !resend) {
      return Response.json({ ok: true, skipped: "mail_service_not_configured" })
    }

    const [{ data: senderProfile }, { data: recipientProfile }, { data: skillRow }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", msg.sender_id).maybeSingle<{ display_name: string | null }>(),
      admin
        .from("profiles")
        .select("display_name, email_notification_settings, preferred_locale")
        .eq("id", msg.recipient_id)
        .maybeSingle<{
          display_name: string | null
          email_notification_settings?: unknown
          preferred_locale?: string | null
        }>(),
      admin
        .from("skills")
        .select("title")
        .eq("id", String(msg.origin_skill_id))
        .maybeSingle<{ title: string | null }>(),
    ])

    const userResult = await admin.auth.admin.getUserById(msg.recipient_id)
    const recipientEmail = userResult.data.user?.email?.trim() ?? ""
    if (!recipientEmail) {
      return Response.json({ ok: true, skipped: "recipient_email_not_found" })
    }

    const recipientPrefs = parseEmailNotificationSettings(recipientProfile?.email_notification_settings)
    // 相談メール（Resend）のみ抑制。insertInquiryMessage 側のアプリ内通知は既に作成済み。
    if (!shouldSendEmailForTopic(recipientPrefs, "inquiry_chat")) {
      return Response.json({ ok: true, skipped: "recipient_email_notifications_disabled" })
    }

    const rawLocale = recipientProfile?.preferred_locale
    const recipientLocale: Locale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE
    const dict = getDictionary(recipientLocale)
    const subjectText = formatMessage(lookupMessage(dict, "email.inquiryMessage.subject"))
    const userFallback = formatMessage(lookupMessage(dict, "email.inquiryMessage.userFallback"))
    const skillFallback = formatMessage(lookupMessage(dict, "email.inquiryMessage.skillFallback"))

    const baseUrl = getAppBaseUrl()
    const chatUrl = `${baseUrl}/inquiry/${encodeURIComponent(msg.sender_id)}?skill_id=${encodeURIComponent(
      String(msg.origin_skill_id),
    )}`

    const html = await render(
      InquiryMessageEmail({
        recipientName: recipientProfile?.display_name?.trim() || userFallback,
        senderName: senderProfile?.display_name?.trim() || userFallback,
        skillTitle: skillRow?.title?.trim() || skillFallback,
        messageSnippet: trimSnippet(msg.content),
        chatUrl,
        locale: recipientLocale,
      }),
    )

    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "GritVib <notifications@gritvib.com>"
    await resend.emails.send({
      from: fromAddress,
      to: recipientEmail,
      subject: subjectText,
      html,
    })

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send inquiry email"
    return Response.json({ error: message }, { status: 500 })
  }
}
