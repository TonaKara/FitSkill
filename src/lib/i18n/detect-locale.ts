import {
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from "@/lib/i18n/locales"

/** 自動検出時のフォールバック（日本以外） */
const AUTO_DETECT_FALLBACK_LOCALE: Locale = "en"

/**
 * BCP47 ロケールタグが「日本向け端末」とみなせるか。
 * - 地域が JP（例: ja-JP, en-JP）
 * - 地域なしで言語が ja（例: ja）
 */
export function isJapanDeviceLocale(tag: string): boolean {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) {
    return false
  }

  const parts = normalized.split("-")
  const primary = parts[0]

  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i]
    if (part.length === 2 && /^[a-z]{2}$/.test(part)) {
      return part === "jp"
    }
  }

  return primary === "ja"
}

/** 単一のロケールタグから表示 locale を決定する */
export function pickLocaleFromDeviceLocaleTag(tag: string | null | undefined): Locale {
  if (!tag) {
    return AUTO_DETECT_FALLBACK_LOCALE
  }
  return isJapanDeviceLocale(tag) ? "ja" : "en"
}

/**
 * Accept-Language ヘッダから表示 locale を決定する。
 * 端末の国・地域設定を反映したタグ（ja-JP / en-JP 等）を優先的に解釈する。
 *   例: "ja-JP,ja;q=0.9" → "ja"
 *   例: "en-US,en;q=0.9" → "en"
 *   例: "en-JP,en;q=0.9" → "ja"（国が日本）
 * 手動切り替え（Cookie）は呼び出し側で先に評価すること。
 */
export function pickLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) {
    return AUTO_DETECT_FALLBACK_LOCALE
  }

  const entries = acceptLanguage
    .split(",")
    .map((raw) => {
      const [tag, ...params] = raw.trim().split(";")
      const qParam = params.find((p) => p.trim().startsWith("q="))
      const q = qParam ? Number(qParam.split("=")[1]) : 1
      return { tag: tag?.trim() ?? "", q: Number.isFinite(q) ? q : 0 }
    })
    .filter((e) => e.tag.length > 0)
    .sort((a, b) => b.q - a.q)

  if (entries.length === 0) {
    return AUTO_DETECT_FALLBACK_LOCALE
  }

  return pickLocaleFromDeviceLocaleTag(entries[0].tag)
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

function readIntlResolvedLocale(): string | null {
  if (typeof Intl === "undefined") {
    return null
  }
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale
    return typeof tag === "string" && tag.length > 0 ? tag : null
  } catch {
    return null
  }
}

/**
 * browser 用: navigator / Intl から端末ロケールを取得。
 * 国・地域が日本 → "ja"、それ以外 → "en"。
 * 手動切り替え（Cookie）は呼び出し側で先に評価すること。
 */
export function detectLocaleFromNavigator(): Locale {
  if (typeof navigator === "undefined") {
    return AUTO_DETECT_FALLBACK_LOCALE
  }

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
    readIntlResolvedLocale(),
  ].filter((v): v is string => typeof v === "string" && v.length > 0)

  if (candidates.length === 0) {
    return AUTO_DETECT_FALLBACK_LOCALE
  }

  return pickLocaleFromDeviceLocaleTag(candidates[0])
}

export const SUPPORTED_LOCALE_LIST: readonly Locale[] = SUPPORTED_LOCALES
