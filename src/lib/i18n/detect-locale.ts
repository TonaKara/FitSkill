import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/locales"

/**
 * Accept-Language ヘッダから優先 locale を 1 つ決定する。
 *   例: "en-US,en;q=0.9,ja;q=0.8" → "en"
 *   解釈不能なら DEFAULT_LOCALE を返す。
 */
export function pickLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE
  }

  const entries = acceptLanguage
    .split(",")
    .map((raw) => {
      const [tag, ...params] = raw.trim().split(";")
      const qParam = params.find((p) => p.trim().startsWith("q="))
      const q = qParam ? Number(qParam.split("=")[1]) : 1
      return { tag: tag?.trim().toLowerCase() ?? "", q: Number.isFinite(q) ? q : 0 }
    })
    .filter((e) => e.tag.length > 0)
    .sort((a, b) => b.q - a.q)

  for (const entry of entries) {
    const primary = entry.tag.split("-")[0]
    if (isSupportedLocale(primary)) {
      return primary
    }
  }

  return DEFAULT_LOCALE
}

/** Cookie 文字列 ("a=1; b=2") から locale Cookie を取り出す */
export function readLocaleCookieFromHeader(cookieHeader: string | null | undefined): Locale | null {
  if (!cookieHeader) {
    return null
  }
  const pairs = cookieHeader.split(";")
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=")
    if (name?.trim() === LOCALE_COOKIE_NAME) {
      const value = decodeURIComponent(rest.join("=").trim())
      if (isSupportedLocale(value)) {
        return value
      }
    }
  }
  return null
}

/** browser 用: document.cookie から locale を読み取る */
export function readLocaleCookieFromDocument(): Locale | null {
  if (typeof document === "undefined") {
    return null
  }
  return readLocaleCookieFromHeader(document.cookie)
}

/** browser 用: navigator から優先言語を取得 */
export function detectLocaleFromNavigator(): Locale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE
  }
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter((v): v is string => typeof v === "string" && v.length > 0)

  for (const tag of candidates) {
    const primary = tag.toLowerCase().split("-")[0]
    if (isSupportedLocale(primary)) {
      return primary
    }
  }
  return DEFAULT_LOCALE
}

export const SUPPORTED_LOCALE_LIST: readonly Locale[] = SUPPORTED_LOCALES
