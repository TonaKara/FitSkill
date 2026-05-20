import "server-only"

import { cookies, headers } from "next/headers"
import {
  pickLocaleFromAcceptLanguage,
  readLocaleCookieFromHeader,
} from "@/lib/i18n/detect-locale"
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/locales"

/**
 * Server Component / `generateMetadata` 用の locale 解決。
 *
 * 優先順:
 *   1. `gv_locale` Cookie
 *   2. `Accept-Language` ヘッダ
 *   3. {@link DEFAULT_LOCALE}（"ja"）
 *
 * 失敗時も throw せず "ja" を返す（既存ユーザー＝全員日本人にとって完全互換）。
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies()
    const fromCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value
    if (isSupportedLocale(fromCookie)) {
      return fromCookie
    }
    const h = await headers()
    const fromCookieHeader = readLocaleCookieFromHeader(h.get("cookie"))
    if (fromCookieHeader) {
      return fromCookieHeader
    }
    return pickLocaleFromAcceptLanguage(h.get("accept-language"))
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Open Graph `locale` プロパティ用（ja → "ja_JP" / en → "en_US"） */
export function localeToOgLocale(locale: Locale): string {
  return locale === "en" ? "en_US" : "ja_JP"
}
