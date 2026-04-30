const STORAGE_KEY = "gritvib:home-list-scroll-y"

/**
 * トップのスキル一覧から詳細へ進む前に、現在のスクロール位置を保存する
 */
export function saveHomeListScrollPosition(): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, String(window.scrollY))
  } catch {
    // ストレージ満杯・プライベートモード等
  }
}

/**
 * トップ（一覧）表示時に一度だけ読み出して消す。戻る値は window.scrollTo の top 用
 */
export function consumeHomeListScrollY(): number | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    if (raw == null) {
      return null
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      return null
    }
    return n
  } catch {
    return null
  }
}

