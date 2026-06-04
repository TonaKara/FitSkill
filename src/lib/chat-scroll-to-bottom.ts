/** チャット一覧を末尾までスクロール（レイアウト確定後に再試行）。 */
export function scrollElementToBottom(el: HTMLElement | null): void {
  if (!el) return
  const apply = () => {
    el.scrollTop = el.scrollHeight
  }
  apply()
  requestAnimationFrame(() => {
    apply()
    requestAnimationFrame(apply)
  })
}

/** 初回表示・画像読み込み直後など、遅延してもう一度末尾へ（PC のレイアウト遅延も想定）。 */
export function scrollElementToBottomSoon(el: HTMLElement | null): () => void {
  scrollElementToBottom(el)
  const delays = [50, 150, 400, 800, 1200]
  const ids = delays.map((ms) =>
    window.setTimeout(() => scrollElementToBottom(el), ms),
  )
  return () => {
    for (const id of ids) window.clearTimeout(id)
  }
}
