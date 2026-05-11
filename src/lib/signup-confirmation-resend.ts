import "server-only"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { buildSignupConfirmationRedirectUrl } from "@/lib/auth-email-flow"

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return null
  }
  return createClient(url, anonKey)
}

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

async function sendSignupConfirmationViaResend(to: string, actionLink: string): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    return false
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "GritVib <notifications@gritvib.com>"
  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: "GritVib メールアドレスの確認",
    html: renderSignupConfirmationEmail(actionLink),
  })

  if (error) {
    console.error("[signup-confirmation-resend] resend.emails.send failed", error)
    return false
  }

  return true
}

export async function sendSignupConfirmationEmail(email: string): Promise<boolean> {
  const redirectTo = buildSignupConfirmationRedirectUrl()
  const supabase = getSupabasePublicClient()
  if (!supabase) {
    return false
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  if (!error) {
    return true
  }

  console.error("[signup-confirmation-resend] supabase.auth.resend failed", {
    message: error.message,
    code: error.code,
    status: error.status,
  })

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return false
  }

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  })

  const actionLink = data?.properties?.action_link?.trim() ?? ""
  if (linkError || !actionLink) {
    console.error("[signup-confirmation-resend] admin.generateLink failed", linkError)
    return false
  }

  return sendSignupConfirmationViaResend(email, actionLink)
}
