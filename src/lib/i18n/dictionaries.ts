import jaMessages from "./messages/ja.json"
import enMessages from "./messages/en.json"
import type { Locale } from "@/lib/i18n/locales"

/**
 * 翻訳辞書（ネストされた string ツリー）。
 * 値は string、または更にネストされたオブジェクト。
 */
export type MessageNode = string | { [key: string]: MessageNode }
export type MessageDictionary = { [key: string]: MessageNode }

const DICTIONARIES: Record<Locale, MessageDictionary> = {
  ja: jaMessages as MessageDictionary,
  en: enMessages as MessageDictionary,
}

export function getDictionary(locale: Locale): MessageDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.ja
}

/**
 * "common.cancel" のようなドット区切りキーを辿って string を返す。
 * 見つからない場合はキー文字列をそのまま返す（プレースホルダ）。
 */
export function lookupMessage(dict: MessageDictionary, key: string): string {
  const segments = key.split(".")
  let cursor: MessageNode | undefined = dict
  for (const seg of segments) {
    if (cursor && typeof cursor === "object") {
      cursor = (cursor as { [k: string]: MessageNode })[seg]
    } else {
      return key
    }
  }
  return typeof cursor === "string" ? cursor : key
}

/**
 * lookupMessage と同じだが、キーが見つからない / 値が string でない場合は undefined を返す。
 * Fallback を呼び出し側で扱いたい場合に使う。
 */
export function lookupMessageOrUndefined(
  dict: MessageDictionary,
  key: string,
): string | undefined {
  const segments = key.split(".")
  let cursor: MessageNode | undefined = dict
  for (const seg of segments) {
    if (cursor && typeof cursor === "object") {
      cursor = (cursor as { [k: string]: MessageNode })[seg]
    } else {
      return undefined
    }
  }
  return typeof cursor === "string" ? cursor : undefined
}

/** {name} のような単純なプレースホルダ置換 */
export function formatMessage(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key]
    return v === undefined || v === null ? `{${key}}` : String(v)
  })
}
