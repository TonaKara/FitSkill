/**
 * FromHere ホーム画面のフィルター状態と URL クエリの相互変換。
 *
 * - URL クエリパラメータ:
 *     ?category=<key>   絞り込みカテゴリ（"all" はデフォルトなので URL からは省略）
 *     ?q=<string>       検索キーワード（空はデフォルト）
 * - **不正な値は無視してデフォルトにフォールバック**する（攻撃面/壊れたリンクへの耐性）。
 * - シリアライズはデフォルト値を **キーごと省く** ことで URL を綺麗に保つ。
 *
 * 以前は range / sort も持っていたが、ホームの構成変更（4 セクション固定）に伴い
 * 廃止した。
 */

import { FROMHERE_CATEGORIES } from "@/fromhere/_product-validation"
import type { FromHereCategory } from "@/fromhere/types"

export type HomeFilters = {
  q: string
  category: FromHereCategory | "all"
}

export const HOME_FILTERS_DEFAULT: HomeFilters = {
  q: "",
  category: "all",
}

/** 検索キーワードの URL 上の最大長（過度に長い URL を防ぐ） */
const Q_MAX_LENGTH = 200

const VALID_CATEGORIES_WITH_ALL = new Set<FromHereCategory | "all">([
  "all",
  ...FROMHERE_CATEGORIES,
])

/** URLSearchParams から filter state を組み立てる。不正値はデフォルトに正規化。 */
export function readHomeFiltersFromSearchParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): HomeFilters {
  const get = (key: string): string => {
    const v = params.get(key)
    return typeof v === "string" ? v : ""
  }

  const qRaw = get("q").trim().slice(0, Q_MAX_LENGTH)
  const categoryRaw = get("category")

  const category: FromHereCategory | "all" = VALID_CATEGORIES_WITH_ALL.has(
    categoryRaw as FromHereCategory | "all",
  )
    ? (categoryRaw as FromHereCategory | "all")
    : "all"

  return { q: qRaw, category }
}

/**
 * filter state を URL クエリ文字列にする（先頭の `?` は含まない）。
 * - デフォルト値のキーは省略する。
 * - 既存パラメータを引き継ぎたい場合は呼び出し側で base を渡す。
 */
export function buildHomeFiltersQueryString(
  filters: HomeFilters,
  base?: URLSearchParams | ReadonlyURLSearchParams,
): string {
  const sp = new URLSearchParams(base ? base.toString() : "")
  applyFilter(sp, "q", filters.q.trim(), HOME_FILTERS_DEFAULT.q)
  applyFilter(sp, "category", filters.category, HOME_FILTERS_DEFAULT.category)
  /** 旧 URL に range / sort が残っていた場合は安全のため除去する（リンク互換性のため） */
  sp.delete("range")
  sp.delete("sort")
  return sp.toString()
}

function applyFilter(sp: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (!value || value === defaultValue) {
    sp.delete(key)
    return
  }
  sp.set(key, key === "q" ? value.slice(0, Q_MAX_LENGTH) : value)
}

/**
 * Next.js の `ReadonlyURLSearchParams` を表す軽量な型エイリアス。
 */
type ReadonlyURLSearchParams = {
  get(name: string): string | null
  has(name: string): boolean
  toString(): string
}
