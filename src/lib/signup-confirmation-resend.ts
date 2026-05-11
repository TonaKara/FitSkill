import "server-only"

import { createClient } from "@supabase/supabase-js"
import { type EmailOtpType } from "@supabase/supabase-js"
import { Resend } from "resend"
import { buildSignupConfirmationRedirectUrl } from "@/lib/auth-email-flow"

type GenerateLinkType = "magiclink" | "invite"

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return null
  }
  return createClient(url, serviceRoleKey)
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return null
  }
  return new Resend(key)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderSignupConfirmationEmail(actionLink: string): string {
  const safeLink = escapeHtml(actionLink)
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;background:#09090b;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:26px;">
      <h1 style="margin:0 0 16px;color:#fff;font-size:21px;font-weight:800;">メールアドレスの確認</h1>
      <p style="margin:0 0 12px;color:#e4e4e7;font-size:14px;line-height:1.7;">GritVib へのご登録ありがとうございます。下のボタンからメールアドレスを確認してください。</p>
      <p style="margin:18px 0 0;">
        <a href="${safeLink}" style="display:inline-block;background:#c62828;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:12px 22px;">
          メールアドレスを確認する
        </a>
      </p>
      <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.6;">このメールは送信専用です。返信できません。</p>
    </div>
  </body>
</html>`
}

function buildVerificationCallbackUrl(hashedToken: string, otpType: EmailOtpType): string {
  const callbackUrl = new URL(buildSignupConfirmationRedirectUrl())
  callbackUrl.searchParams.set("token_hash", hashedToken)
  callbackUrl.searchParams.set("type", otpType)
  return callbackUrl.toString()
}

async function createSignupVerificationLink(
  email: string,
  linkType: GenerateLinkType,
  otpType: EmailOtpType,
): Promise<string | null> {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return null
  }

  const redirectTo = buildSignupConfirmationRedirectUrl()
  const { data, error } = await admin.auth.admin.generateLink({
    type: linkType,
    email,
    options: {
      redirectTo,
    },
  })

  if (error) {
    console.error("[signup-confirmation-resend] admin.generateLink failed", {
      linkType,
      message: error.message,
      code: error.code,
      status: error.status,
    })
    return null
  }

  const hashedToken = data?.properties?.hashed_token?.trim() ?? ""
  if (hashedToken) {
    return buildVerificationCallbackUrl(hashedToken, otpType)
  }

  const actionLink = data?.properties?.action_link?.trim() ?? ""
  return actionLink || null
}

async function sendSignupConfirmationViaResend(to: string, actionLink: string): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    console.error("[signup-confirmation-resend] RESEND_API_KEY is not configured")
    return false
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "GritVib <notifications@gritvib.com>"
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "GritVib メールアドレスの確認",
    html: renderSignupConfirmationEmail(actionLink),
  })

  if (error) {
    console.error("[signup-confirmation-resend] resend.emails.send failed", error)
    return false
  }

  if (!data?.id) {
    console.error("[signup-confirmation-resend] resend.emails.send returned no message id", { to })
    return false
  }

  return true
}

export async function sendSignupConfirmationEmail(email: string): Promise<boolean> {
  const linkCandidates: Array<{ linkType: GenerateLinkType; otpType: EmailOtpType }> = [
    { linkType: "magiclink", otpType: "magiclink" },
    { linkType: "invite", otpType: "invite" },
  ]

  for (const candidate of linkCandidates) {
    const actionLink = await createSignupVerificationLink(email, candidate.linkType, candidate.otpType)
    if (!actionLink) {
      continue
    }

    const sent = await sendSignupConfirmationViaResend(email, actionLink)
    if (sent) {
      return true
    }
  }

  return false
}
