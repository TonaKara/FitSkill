import "server-only"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import {
  formatMessage,
  getDictionary,
  lookupMessage,
} from "@/lib/i18n/dictionaries"
import { DEFAULT_LOCALE, localeToHtmlLang, type Locale } from "@/lib/i18n/locales"
import { getAppBaseUrl } from "@/lib/site-seo"

export type PasswordResetEmailFailureReason =
  | "missing_config"
  | "link_generation"
  | "delivery"

export type PasswordResetEmailResult =
  | { ok: true }
  | { ok: false; reason: PasswordResetEmailFailureReason }

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

function resolveResendFromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim()
  if (configured) {
    return configured
  }
  return "GritVib <notifications@gritvib.com>"
}

/**
 * 再設定リンクの構築。
 * `?token_hash=...&type=recovery&next=/auth/update-password` 形式とすることで、
 * PKCE の `code_verifier` がブラウザに存在しなくても（＝別端末・別ブラウザでメールを開いても）
 * `/auth/callback` の `verifyOtp({ type: 'recovery', token_hash })` 経路でセッション化できる。
 */
function buildPasswordResetCallbackUrl(hashedToken: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "")
  const callback = new URL(`${base}/auth/callback`)
  callback.searchParams.set("token_hash", hashedToken)
  callback.searchParams.set("type", "recovery")
  callback.searchParams.set("next", "/auth/update-password")
  return callback.toString()
}

function renderPasswordResetEmail(actionLink: string, locale: Locale): string {
  const safeLink = escapeHtml(actionLink)
  const dict = getDictionary(locale)
  const heading = formatMessage(lookupMessage(dict, "email.passwordReset.heading"))
  const intro = formatMessage(lookupMessage(dict, "email.passwordReset.intro"))
  const lineExpiry = formatMessage(lookupMessage(dict, "email.passwordReset.lineExpiry"))
  const lineIgnore = formatMessage(lookupMessage(dict, "email.passwordReset.lineIgnore"))
  const cta = formatMessage(lookupMessage(dict, "email.passwordReset.cta"))
  const footer = formatMessage(lookupMessage(dict, "email.footer"))

  return `<!doctype html>
<html lang="${escapeHtml(localeToHtmlLang(locale))}">
  <body style="margin:0;background:#09090b;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:26px;">
      <h1 style="margin:0 0 16px;color:#fff;font-size:21px;font-weight:800;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 12px;color:#e4e4e7;font-size:14px;line-height:1.7;">${escapeHtml(intro)}</p>
      <p style="margin:18px 0 0;">
        <a href="${safeLink}" style="display:inline-block;background:#e64a19;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:12px 22px;">
          ${escapeHtml(cta)}
        </a>
      </p>
      <p style="margin:18px 0 0;color:#a1a1aa;font-size:13px;line-height:1.7;">${escapeHtml(lineExpiry)}</p>
      <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;line-height:1.7;">${escapeHtml(lineIgnore)}</p>
      <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.6;">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`
}

/**
 * `admin.generateLink({ type: 'recovery', email })` を呼び、戻り値の `properties.hashed_token`
 * を取得して、`/auth/callback?token_hash=...&type=recovery&next=/auth/update-password` の URL を構築する。
 *
 * - generateLink 自体はメールを送信しない（type が "recovery" のため）。よって Supabase 側で
 *   重複メールが飛ぶ心配はない。
 * - admin.generateLink が動作するためには `SUPABASE_SERVICE_ROLE_KEY` の設定が必須。
 */
async function generatePasswordResetCallbackUrl(email: string): Promise<string | null> {
  const admin = getSupabaseAdminClient()
  if (!admin) {
    return null
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  })

  if (error) {
    console.error("[password-reset-email] admin.generateLink failed", {
      message: error.message,
      code: error.code,
      status: error.status,
    })
    return null
  }

  const hashedToken = data?.properties?.hashed_token?.trim() ?? ""
  if (hashedToken) {
    return buildPasswordResetCallbackUrl(hashedToken)
  }

  // ハッシュトークンが取得できなかった場合、`action_link` をそのまま使う最終フォールバック。
  // （`action_link` は Supabase 経由でリダイレクトされ、最終的に `redirectTo` に着地するため、
  //  PKCE 経路にフォールバックする形になるが、generateLink がトークンを返さないケースは事実上ない）
  const actionLink = data?.properties?.action_link?.trim() ?? ""
  return actionLink || null
}

async function sendPasswordResetViaResend(
  to: string,
  actionLink: string,
  locale: Locale,
): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    console.error("[password-reset-email] RESEND_API_KEY is not configured")
    return false
  }

  const fromAddress = resolveResendFromAddress()
  const dict = getDictionary(locale)
  const subject = formatMessage(lookupMessage(dict, "email.passwordReset.subject"))
  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html: renderPasswordResetEmail(actionLink, locale),
  })

  if (error) {
    console.error("[password-reset-email] resend.emails.send failed", {
      to,
      fromAddress,
      message: error.message,
      name: error.name,
    })
    return false
  }

  if (!data?.id) {
    console.error("[password-reset-email] resend.emails.send returned no message id", { to })
    return false
  }

  return true
}

/**
 * パスワード再設定メールを Resend 経由で送信する。
 *
 * 設計上のポイント:
 * - Supabase の `resetPasswordForEmail` ではなく `admin.generateLink` + Resend を使う。
 *   これにより `token_hash` 経路でリンクを構築できるため、別端末・別ブラウザでメールを
 *   開いても recovery セッションが確立できる（PKCE の code_verifier に依存しない）。
 * - 既存ユーザーの体感を変えないため、メールの差出人 (`RESEND_FROM_EMAIL`) と本文構造は
 *   他の通知メールと同一の `event-email.ts` 系と揃える。
 *
 * locale は呼び出し側で `getServerLocale()` 等を使って決定する。指定が無ければ "ja"。
 */
export async function sendPasswordResetEmail(
  email: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PasswordResetEmailResult> {
  if (!getSupabaseAdminClient() || !getResendClient()) {
    console.error("[password-reset-email] missing server configuration", {
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
      hasResendFromEmail: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
    })
    return { ok: false, reason: "missing_config" }
  }

  const actionLink = await generatePasswordResetCallbackUrl(email)
  if (!actionLink) {
    return { ok: false, reason: "link_generation" }
  }

  const sent = await sendPasswordResetViaResend(email, actionLink, locale)
  if (!sent) {
    return { ok: false, reason: "delivery" }
  }

  return { ok: true }
}
