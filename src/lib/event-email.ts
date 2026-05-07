import "server-only"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

type SendUserEventEmailParams = {
  userId: string
  subject: string
  heading: string
  intro: string
  lines?: string[]
  ctaLabel?: string
  ctaUrl?: string
}

function getSupabaseAdminClient() {
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderHtml(params: {
  heading: string
  intro: string
  lines: string[]
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const linesHtml = params.lines
    .map((line) => `<p style="margin:0 0 10px;color:#e4e4e7;font-size:14px;line-height:1.7;">${escapeHtml(line)}</p>`)
    .join("")
  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:18px 0 0;">
  <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#c62828;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:12px 22px;">
    ${escapeHtml(params.ctaLabel)}
  </a>
</p>`
      : ""
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;background:#09090b;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:26px;">
      <h1 style="margin:0 0 16px;color:#fff;font-size:21px;font-weight:800;">${escapeHtml(params.heading)}</h1>
      <p style="margin:0 0 12px;color:#e4e4e7;font-size:14px;line-height:1.7;">${escapeHtml(params.intro)}</p>
      ${linesHtml}
      ${ctaHtml}
      <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.6;">このメールは送信専用です。返信できません。</p>
    </div>
  </body>
</html>`
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://gritvib.com"
}

export async function sendUserEventEmail(params: SendUserEventEmailParams): Promise<void> {
  const userId = params.userId.trim()
  if (!userId) {
    return
  }
  const supabaseAdmin = getSupabaseAdminClient()
  const resend = getResendClient()
  if (!supabaseAdmin || !resend) {
    return
  }

  const userResult = await supabaseAdmin.auth.admin.getUserById(userId)
  const to = userResult.data.user?.email?.trim() ?? ""
  if (!to) {
    return
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "GritVib <notifications@gritvib.com>"
  const html = renderHtml({
    heading: params.heading,
    intro: params.intro,
    lines: params.lines ?? [],
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
  })

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: params.subject,
    html,
  })
}
