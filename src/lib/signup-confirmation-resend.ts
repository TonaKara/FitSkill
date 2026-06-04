import "server-only"

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { type EmailOtpType } from "@supabase/supabase-js"
import { Resend } from "resend"
import {
  buildSignupConfirmationRedirectUrl,
  sanitizeSignupConfirmationNextPath,
  SIGNUP_CONFIRMATION_NEXT_PATH,
} from "@/lib/auth-email-flow"
import {
  formatMessage,
  getDictionary,
  lookupMessage,
} from "@/lib/i18n/dictionaries"
import { DEFAULT_LOCALE, localeToHtmlLang, type Locale } from "@/lib/i18n/locales"

type GenerateLinkType = "magiclink" | "invite" | "recovery"

export type SignupConfirmationResendFailureReason = "missing_config" | "link_generation" | "delivery"

export type SignupConfirmationResendResult =
  | { ok: true }
  | { ok: false; reason: SignupConfirmationResendFailureReason }

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

function renderSignupConfirmationEmail(actionLink: string, locale: Locale): string {
  const safeLink = escapeHtml(actionLink)
  const dict = getDictionary(locale)
  const heading = formatMessage(lookupMessage(dict, "email.signupConfirmation.heading"))
  const intro = formatMessage(lookupMessage(dict, "email.signupConfirmation.intro"))
  const cta = formatMessage(lookupMessage(dict, "email.signupConfirmation.cta"))
  const footer = formatMessage(lookupMessage(dict, "email.footer"))
  return `<!doctype html>
<html lang="${escapeHtml(localeToHtmlLang(locale))}">
  <body style="margin:0;background:#ffffff;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#000000;">
    <div style="max-width:480px;margin:0 auto;text-align:center;">
      <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.02em;color:#71717a;">GritVib</p>
      <h1 style="margin:0 0 16px;color:#000000;font-size:22px;font-weight:500;line-height:1.35;letter-spacing:-0.02em;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 24px;color:#3f3f46;font-size:14px;line-height:1.75;text-align:center;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 28px;text-align:center;">
        <a href="${safeLink}" style="display:inline-block;min-width:200px;background:#000000;color:#ffffff;text-decoration:none;font-weight:500;font-size:16px;line-height:1;border-radius:9999px;padding:14px 28px;">
          ${escapeHtml(cta)}
        </a>
      </p>
      <p style="margin:0;color:#71717a;font-size:12px;line-height:1.65;text-align:center;">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`
}

function buildVerificationCallbackUrl(
  hashedToken: string,
  otpType: EmailOtpType,
  nextPath: string,
): string {
  const callbackUrl = new URL(buildSignupConfirmationRedirectUrl(nextPath))
  callbackUrl.searchParams.set("token_hash", hashedToken)
  callbackUrl.searchParams.set("type", otpType)
  return callbackUrl.toString()
}

async function createSignupVerificationLink(
  email: string,
  linkType: GenerateLinkType,
  otpType: EmailOtpType,
  nextPath: string,
): Promise<string | null> {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return null
  }

  const redirectTo = buildSignupConfirmationRedirectUrl(nextPath)
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
    return buildVerificationCallbackUrl(hashedToken, otpType, nextPath)
  }

  const actionLink = data?.properties?.action_link?.trim() ?? ""
  return actionLink || null
}

function resolveResendFromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim()
  if (configured) {
    return configured
  }
  return "GritVib <notifications@gritvib.com>"
}

async function sendSignupConfirmationViaResend(
  to: string,
  actionLink: string,
  locale: Locale,
): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    console.error("[signup-confirmation-resend] RESEND_API_KEY is not configured")
    return false
  }

  const fromAddress = resolveResendFromAddress()
  const dict = getDictionary(locale)
  const subject = formatMessage(lookupMessage(dict, "email.signupConfirmation.subject"))
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html: renderSignupConfirmationEmail(actionLink, locale),
  })

  if (error) {
    console.error("[signup-confirmation-resend] resend.emails.send failed", {
      to,
      fromAddress,
      message: error.message,
      name: error.name,
    })
    return false
  }

  if (!data?.id) {
    console.error("[signup-confirmation-resend] resend.emails.send returned no message id", { to })
    return false
  }

  return true
}

export async function sendSignupConfirmationEmail(
  email: string,
  /**
   * メール本文の言語。未指定の場合は 'ja'（既存挙動と完全一致）。
   * サインアップ時点ではまだ profile が存在しないことが多いため、呼び出し側でリクエスト
   * Cookie や Accept-Language を見て決めることを推奨。
   */
  locale: Locale = DEFAULT_LOCALE,
  nextPath: string = SIGNUP_CONFIRMATION_NEXT_PATH,
): Promise<SignupConfirmationResendResult> {
  const safeNext = sanitizeSignupConfirmationNextPath(nextPath)
  if (!getSupabaseAdminClient() || !getResendClient()) {
    console.error("[signup-confirmation-resend] missing server configuration", {
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
      hasResendFromEmail: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
    })
    return { ok: false, reason: "missing_config" }
  }

  const linkCandidates: Array<{ linkType: GenerateLinkType; otpType: EmailOtpType }> = [
    { linkType: "magiclink", otpType: "magiclink" },
    { linkType: "invite", otpType: "invite" },
    { linkType: "recovery", otpType: "recovery" },
  ]

  let generatedLink = false
  for (const candidate of linkCandidates) {
    const actionLink = await createSignupVerificationLink(
      email,
      candidate.linkType,
      candidate.otpType,
      safeNext,
    )
    if (!actionLink) {
      continue
    }

    generatedLink = true
    const sent = await sendSignupConfirmationViaResend(email, actionLink, locale)
    if (sent) {
      return { ok: true }
    }
  }

  return { ok: false, reason: generatedLink ? "delivery" : "link_generation" }
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      console.error("[signup-confirmation-resend] listUsers failed", error.message)
      return null
    }
    const users = data?.users ?? []
    const match = users.find((u) => (u.email ?? "").trim().toLowerCase() === normalized)
    if (match) {
      return match
    }
    if (users.length < 1000) {
      break
    }
  }
  return null
}

export type UpdatePendingSignupEmailFailureReason =
  | "not_found"
  | "already_confirmed"
  | "email_taken"
  | "internal"

export type UpdatePendingSignupEmailResult =
  | { ok: true }
  | { ok: false; reason: UpdatePendingSignupEmailFailureReason }

/**
 * 未確認のサインアップユーザーのメールアドレスを差し替える（入力ミス修正用）。
 * `previousEmail` と一致する未確認ユーザーのみ更新可能。
 */
export async function updatePendingSignupEmailIfAllowed(
  previousEmail: string,
  newEmail: string,
): Promise<UpdatePendingSignupEmailResult> {
  const from = previousEmail.trim().toLowerCase()
  const to = newEmail.trim().toLowerCase()
  if (!from || !to || from === to) {
    return { ok: true }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return { ok: false, reason: "internal" }
  }

  const current = await findAuthUserByEmail(admin, from)
  if (!current) {
    return { ok: false, reason: "not_found" }
  }

  if (current.email_confirmed_at) {
    return { ok: false, reason: "already_confirmed" }
  }

  const taken = await findAuthUserByEmail(admin, to)
  if (taken && taken.id !== current.id) {
    return { ok: false, reason: "email_taken" }
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(current.id, {
    email: to,
    email_confirm: false,
  })
  if (updateError) {
    console.error("[signup-confirmation-resend] updateUserById email failed", updateError.message)
    const msg = updateError.message.toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { ok: false, reason: "email_taken" }
    }
    return { ok: false, reason: "internal" }
  }

  return { ok: true }
}
