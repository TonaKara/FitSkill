import { MakerNotFound } from "@/fromhere/u/[handle]/MakerNotFound"

/**
 * `/fromhere/u/[handle]` 配下で `notFound()` が呼ばれた場合に表示する 404 ページ。
 * - 通常の 404 ではなく、メーカーが見つからない旨をユーザーフレンドリーに伝える。
 */
export default function NotFound() {
  return <MakerNotFound />
}
