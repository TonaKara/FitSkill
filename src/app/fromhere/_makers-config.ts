/** ----------------------------------------------------------
 *  /fromhere/makers のソート / ページング設定（client/server 共有）
 *
 *  ⚠️ このファイルは `"server-only"` や `next/headers` を import してはいけない。
 *     Client Component (`MakersPageClient.tsx`) と Server data fetcher (`_makers-data.ts`)
 *     の **両方** からインポートされる共有定義のため、サーバー専用の依存を持ち込むと
 *     クライアントバンドルでビルドエラーになる。
 * ---------------------------------------------------------- */

export const MAKERS_PAGE_SIZE = 20

export const MAKERS_SORTS = ["top", "posts", "recent"] as const
export type MakersSort = (typeof MAKERS_SORTS)[number]
export const MAKERS_SORT_DEFAULT: MakersSort = "top"

export function isMakersSort(value: unknown): value is MakersSort {
  return typeof value === "string" && (MAKERS_SORTS as readonly string[]).includes(value)
}

/** URL クエリから {sort, page} を取り出してバリデーション */
export function readMakersQuery(searchParams: Record<string, string | string[] | undefined>): {
  sort: MakersSort
  page: number
} {
  const sortRaw = searchParams.sort
  const sortValue = Array.isArray(sortRaw) ? sortRaw[0] : sortRaw
  const sort: MakersSort = isMakersSort(sortValue) ? sortValue : MAKERS_SORT_DEFAULT

  const pageRaw = searchParams.page
  const pageValue = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw
  const parsed = Number.parseInt(typeof pageValue === "string" ? pageValue : "", 10)
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 1

  return { sort, page }
}
