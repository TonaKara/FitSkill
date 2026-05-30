import { ProductNotFound } from "@/fromhere/p/[slug]/ProductNotFound"

/**
 * `/fromhere/p/[slug]` 配下で `notFound()` が呼ばれた場合の表示。
 * - 下書き状態 / 削除済み / 不正な slug などのケースを一括で吸収する。
 */
export default function NotFound() {
  return <ProductNotFound />
}
