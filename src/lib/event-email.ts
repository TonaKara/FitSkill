import "server-only"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import {
  type EmailNotificationTopicKey,
  parseEmailNotificationSettings,
  shouldSendEmailForTopic,
} from "@/lib/email-notification-settings"
import {
  formatMessage,
  getDictionary,
  lookupMessageOrUndefined,
} from "@/lib/i18n/dictionaries"
import { DEFAULT_LOCALE, isSupportedLocale, localeToHtmlLang, type Locale } from "@/lib/i18n/locales"

/**
 * 翻訳辞書から差し替えたいテキストを指定するオプション。
 *
 * - 各キーは `src/lib/i18n/messages/{ja,en}.json` のドット区切りキー（例: `"email.transactionEstablished.subject"`）。
 * - キーが辞書に存在しない場合は、後方互換のため `subject`/`heading`/`intro`/`lines`/`ctaLabel`（既存日本語値）にフォールバックする。
 * - `values` は翻訳テンプレ内の `{name}` プレースホルダ置換用。
 */
export type LocalizedEmailKeys = {
  subjectKey?: string
  headingKey?: string
  introKey?: string
  /** 文字列キーの配列、または locale 別キー */
  lineKeys?: string[]
  ctaLabelKey?: string
  values?: Record<string, string | number>
}

type SendUserEventEmailParams = {
  userId: string
  /** ユーザー別メール通知設定でフィルタする種別 */
  topic: EmailNotificationTopicKey
  /** 後方互換: 日本語固定の件名／本文。`localizedKeys` が無いか辞書に未定義の場合に使用。 */
  subject: string
  heading: string
  intro: string
  lines?: string[]
  ctaLabel?: string
  ctaUrl?: string
  /**
   * 多言語対応用。指定された場合、ユーザーの `profiles.preferred_locale` を読み取り、
   * `'en'` なら EN 辞書から翻訳を引いて差し替える。`'ja'` または取得失敗時は既存の
   * `subject`/`heading`/`intro`/`lines`/`ctaLabel` をそのまま使う（既存挙動と完全一致）。
   */
  localizedKeys?: LocalizedEmailKeys
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
  htmlLang: string
  heading: string
  intro: string
  lines: string[]
  ctaLabel?: string
  ctaUrl?: string
  footer: string
}): string {
  const linesHtml = params.lines
    .map((line) => `<p style="margin:0 0 10px;color:#e4e4e7;font-size:14px;line-height:1.7;">${escapeHtml(line)}</p>`)
    .join("")
  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:18px 0 0;">
  <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#e64a19;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:12px 22px;">
    ${escapeHtml(params.ctaLabel)}
  </a>
</p>`
      : ""
  return `<!doctype html>
<html lang="${escapeHtml(params.htmlLang)}">
  <body style="margin:0;background:#09090b;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:26px;">
      <h1 style="margin:0 0 16px;color:#fff;font-size:21px;font-weight:800;">${escapeHtml(params.heading)}</h1>
      <p style="margin:0 0 12px;color:#e4e4e7;font-size:14px;line-height:1.7;">${escapeHtml(params.intro)}</p>
      ${linesHtml}
      ${ctaHtml}
      <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.6;">${escapeHtml(params.footer)}</p>
    </div>
  </body>
</html>`
}

/**
 * 翻訳辞書からキーを引いて値を返す。キーが未指定 or 辞書に無い場合は fallback を返す。
 * 既存テキスト（日本語固定）への完全な後方互換性を保証するためのヘルパ。
 */
function resolveLocalizedString(
  locale: Locale,
  key: string | undefined,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  if (!key) {
    return fallback
  }
  const dict = getDictionary(locale)
  const raw = lookupMessageOrUndefined(dict, key)
  if (raw === undefined) {
    return fallback
  }
  return formatMessage(raw, values)
}

/**
 * 取引・相談などのイベントメールを Resend で送信する。
 * メール送信のみ {@link shouldSendEmailForTopic} でフィルタする。アプリ内通知は呼び出し側で常に行うこと。
 *
 * 多言語対応:
 * - `params.localizedKeys` が指定された場合のみ、`profiles.preferred_locale` を確認して英語化を行う。
 * - 指定が無い／locale 取得失敗／キーが辞書に無い場合は、従来通り日本語の `subject`/`heading`/`intro` 等が使われる。
 *   これにより既存ユーザー（全員日本人）はカラム追加前と完全に同じメールを受け取る。
 */
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

  const [{ data: prefRow }, userResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("email_notification_settings, preferred_locale")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ])
  const prefs = parseEmailNotificationSettings(
    (prefRow as { email_notification_settings?: unknown } | null)?.email_notification_settings,
  )
  // メール（Resend）のみスキップ。notifications への insert は各 API／クライアントが別途実行済みであること。
  if (!shouldSendEmailForTopic(prefs, params.topic)) {
    return
  }

  const to = userResult.data.user?.email?.trim() ?? ""
  if (!to) {
    return
  }

  // 後方互換: localizedKeys が無ければ従来通り日本語固定で送る。
  // ある場合のみ、ユーザーの preferred_locale を見て翻訳辞書を引く。
  let locale: Locale = DEFAULT_LOCALE
  if (params.localizedKeys) {
    const rawLocale = (prefRow as { preferred_locale?: string | null } | null)?.preferred_locale
    if (isSupportedLocale(rawLocale)) {
      locale = rawLocale
    }
  }

  const localized = params.localizedKeys
  const values = localized?.values
  const subject = resolveLocalizedString(locale, localized?.subjectKey, params.subject, values)
  const heading = resolveLocalizedString(locale, localized?.headingKey, params.heading, values)
  const intro = resolveLocalizedString(locale, localized?.introKey, params.intro, values)
  const ctaLabel = resolveLocalizedString(locale, localized?.ctaLabelKey, params.ctaLabel ?? "", values)
  const lines: string[] = (() => {
    if (localized?.lineKeys && localized.lineKeys.length > 0) {
      const resolved = localized.lineKeys.map((key, idx) =>
        resolveLocalizedString(locale, key, params.lines?.[idx] ?? "", values),
      )
      return resolved.filter((line) => line.trim() !== "")
    }
    return params.lines ?? []
  })()

  // フッターは locale ごとに辞書から取得（無ければ日本語フォールバック）。
  const footer = resolveLocalizedString(
    locale,
    "email.footer",
    "このメールは送信専用です。返信できません。",
  )

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "GritVib <notifications@gritvib.com>"
  const html = renderHtml({
    htmlLang: localeToHtmlLang(locale),
    heading,
    intro,
    lines,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: params.ctaUrl,
    footer,
  })

  await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  })
}
