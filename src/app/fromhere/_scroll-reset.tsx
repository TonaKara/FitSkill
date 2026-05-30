"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * /fromhere 配下のページを開いた・遷移した時にスクロール位置を最上部へリセットする。
 *
 * - 初回マウント / pathname 変更時に発火する。
 *   ブラウザのリロード時にスクロール位置が復元されて中途半端な位置から開始される現象を補正する目的。
 * - URL にハッシュ（例: `/fromhere#makers`）が含まれる場合は、ブラウザのアンカー
 *   ジャンプ挙動を尊重するためリセットしない。
 * - 本アプリのルートレイアウト（app/layout.tsx）では `<main className="overflow-y-auto">`
 *   が実際のスクロールコンテナになっており、`window.scrollTo` だけでは内側 `<main>` の
 *   スクロール位置が下がったままになる場合があるため、`<main>` 要素と
 *   `document.scrollingElement` を含めて全方位でリセットする。
 * - SSR を考慮して `window` 参照は effect 内に閉じ込める。
 *
 * Server Component の layout から子として配置するだけで動作する。
 */
export function FromHereScrollReset() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    if (window.location.hash) {
      return
    }

    const resetScrollToTop = () => {
      window.scrollTo(0, 0)
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = 0
      }
      document.querySelectorAll<HTMLElement>("main").forEach((el) => {
        if (el.scrollTop !== 0) {
          el.scrollTop = 0
        }
      })
    }

    resetScrollToTop()
    const raf = window.requestAnimationFrame(resetScrollToTop)

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [pathname])

  return null
}
