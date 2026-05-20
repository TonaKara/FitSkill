/**
 * サポート対象ロケール。
 * - DB に保存される値（カテゴリ等）は常に日本語のまま。
 * - 表示テキストのみ locale により出し分ける。
 */
export const SUPPORTED_LOCALES = ["ja", "en"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "ja"

/** Cookie 名（middleware と client で共通利用） */
export const LOCALE_COOKIE_NAME = "gv_locale"

/** Cookie の保存期間（1年） */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE
}

/** html lang 属性に渡す BCP47 形式 */
export function localeToHtmlLang(locale: Locale): string {
  return locale === "ja" ? "ja" : "en"
}
