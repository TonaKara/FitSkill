"use client"

import { useCallback, useMemo } from "react"
import { useLocaleContext, type TranslateValues } from "@/lib/i18n/LocaleProvider"
import {
  formatMessage,
  lookupMessage,
  lookupMessageOrUndefined,
} from "@/lib/i18n/dictionaries"

/**
 * next-intl 互換に近い API。
 *   const t = useTranslations("header")
 *   t("login")  // -> "header.login" を引く
 *
 * namespace を渡さなければルートから引く。
 */
export function useTranslations(namespace?: string) {
  const { dictionary } = useLocaleContext()

  return useCallback(
    (key: string, values?: TranslateValues) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      const raw = lookupMessage(dictionary, fullKey)
      return formatMessage(raw, values)
    },
    [dictionary, namespace],
  )
}

/**
 * 翻訳が無いキーに対し、呼び出し側で指定したフォールバック値を返す t を提供する。
 * 既存定数の日本語ラベルを「表示時のみ」上書きしたい場合に使用（DB 値や内部ロジックは不変のまま）。
 *
 *   const tf = useTranslationsWithFallback("nav.itemLabels")
 *   <span>{tf(item.id, item.label)}</span>
 */
export function useTranslationsWithFallback(namespace?: string) {
  const { dictionary } = useLocaleContext()

  return useCallback(
    (key: string, fallback: string, values?: TranslateValues) => {
      const fullKey = namespace ? `${namespace}.${key}` : key
      const raw = lookupMessageOrUndefined(dictionary, fullKey)
      if (raw === undefined) {
        return fallback
      }
      return formatMessage(raw, values)
    },
    [dictionary, namespace],
  )
}

/** 現在の locale を読み取るシンプルなフック */
export function useLocale() {
  const { locale } = useLocaleContext()
  return locale
}

/** locale 切替フック */
export function useSetLocale() {
  const { setLocale } = useLocaleContext()
  return setLocale
}

/** カテゴリ等で「ja のときは labelJa、en のときは labelEn」を返すヘルパ */
export function useLocalizedLabel() {
  const { locale } = useLocaleContext()
  return useMemo(() => {
    return (labels: { labelJa: string; labelEn?: string | null }) => {
      if (locale === "en" && labels.labelEn) {
        return labels.labelEn
      }
      return labels.labelJa
    }
  }, [locale])
}
