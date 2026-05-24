"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * /japan-entry 配下のページを開いた・遷移した時にスクロール位置を最上部へリセットする。
 *
 * - 初回マウント / pathname 変更時に発火する。
 *   ブラウザのリロード時にスクロール位置が復元されて中途半端な位置から開始される現象を補正する目的。
 * - URL にハッシュ（例: `/japan-entry#pricing`）が含まれる場合は、ブラウザのアンカー
 *   ジャンプ挙動を尊重するためリセットしない。
 * - SSR を考慮して `window` 参照は effect 内に閉じ込める。
 *
 * Server Component の layout から子として配置するだけで動作する。
 */
export function JapanEntryScrollReset() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    if (window.location.hash) {
      return
    }
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
