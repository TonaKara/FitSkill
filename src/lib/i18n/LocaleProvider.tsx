"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import {
  formatMessage,
  getDictionary,
  lookupMessage,
  type MessageDictionary,
} from "@/lib/i18n/dictionaries"
import {
  detectLocaleFromNavigator,
  readLocaleCookieFromDocument,
} from "@/lib/i18n/detect-locale"
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  localeToHtmlLang,
  type Locale,
} from "@/lib/i18n/locales"

export type TranslateValues = Record<string, string | number>

type LocaleContextValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string, values?: TranslateValues) => string
  dictionary: MessageDictionary
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

type LocaleProviderProps = {
  initialLocale: Locale
  children: React.ReactNode
}

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") {
    return
  }
  document.cookie = [
    `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}`,
    "path=/",
    `max-age=${LOCALE_COOKIE_MAX_AGE}`,
    "samesite=lax",
  ].join("; ")
}

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const pathname = usePathname()

  useEffect(() => {
    // server で Cookie が無かったが、端末の国・地域設定（navigator）で
    // 自動同期する。Cookie（手動切り替え含む）が既にあればそれを優先。
    const fromCookie = readLocaleCookieFromDocument()
    if (fromCookie) {
      if (fromCookie !== locale) {
        setLocaleState(fromCookie)
      }
      return
    }
    const fromNavigator = detectLocaleFromNavigator()
    if (fromNavigator !== locale) {
      setLocaleState(fromNavigator)
      writeLocaleCookie(fromNavigator)
    } else {
      writeLocaleCookie(locale)
    }
  }, [locale])

  /**
   * パス遷移ごとに Cookie を読み直し、middleware 等で書き換えられた locale を React state に反映する。
   * （例: `/japan-entry` 配下では middleware が "en" を強制する）
   * これにより、ソフトナビゲーション後でも client コンポーネントの useTranslations が最新ロケールに追従する。
   */
  useEffect(() => {
    const fromCookie = readLocaleCookieFromDocument()
    if (fromCookie && fromCookie !== locale) {
      setLocaleState(fromCookie)
    }
  }, [pathname, locale])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = localeToHtmlLang(locale)
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeLocaleCookie(next)
    // ログイン中ユーザーの profiles.preferred_locale を best-effort で更新する。
    // - メール本文の言語切替に使われる。
    // - 失敗しても UI には影響させない（未ログイン／カラム未追加環境などをサイレントに扱う）。
    // - reload より先に fetch を発火させるが、reload が走るため await はしない。
    if (typeof window !== "undefined") {
      try {
        void fetch("/api/user/preferred-locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => {
          /* noop: best-effort */
        })
      } catch {
        /* noop */
      }
      // Server Component のキャッシュを破棄するため reload する。
      // router.refresh だと Cookie 反映がワンテンポ遅れることがあるため確実な reload を採用。
      window.location.reload()
    }
  }, [])

  const dictionary = useMemo(() => getDictionary(locale), [locale])

  const t = useCallback(
    (key: string, values?: TranslateValues) => {
      const raw = lookupMessage(dictionary, key)
      return formatMessage(raw, values)
    },
    [dictionary],
  )

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, dictionary }),
    [locale, setLocale, t, dictionary],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error("useLocaleContext must be used within LocaleProvider")
  }
  return ctx
}
