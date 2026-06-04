export function measureTextareaContentHeight(el: HTMLTextAreaElement): number {
  const previousHeight = el.style.height
  el.style.height = "0px"
  const contentHeight = el.scrollHeight
  el.style.height = previousHeight
  return contentHeight
}

export function getTextareaHeightForRows(el: HTMLTextAreaElement, rowCount: number): number {
  const style = getComputedStyle(el)
  const lineHeight = parseFloat(style.lineHeight)
  const paddingTop = parseFloat(style.paddingTop)
  const paddingBottom = parseFloat(style.paddingBottom)
  const borderTop = parseFloat(style.borderTopWidth)
  const borderBottom = parseFloat(style.borderBottomWidth)
  const line = Number.isFinite(lineHeight) ? lineHeight : 24
  return Math.ceil(
    line * rowCount + paddingTop + paddingBottom + borderTop + borderBottom,
  )
}

export function syncTextareaAutoGrow(
  el: HTMLTextAreaElement,
  maxRows: number,
): { heightPx: number; maxHeightPx: number; overflowY: "auto" | "hidden" } {
  const maxHeightPx = getTextareaHeightForRows(el, maxRows)
  const minHeightPx = getTextareaHeightForRows(el, 1)
  const contentHeight = measureTextareaContentHeight(el)
  const heightPx = Math.min(Math.max(contentHeight, minHeightPx), maxHeightPx)
  const overflowY = contentHeight > maxHeightPx ? "auto" : "hidden"
  return { heightPx, maxHeightPx, overflowY }
}
