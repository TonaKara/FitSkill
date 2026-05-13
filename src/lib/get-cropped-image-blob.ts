export type GetCroppedImageBlobOptions = {
  mimeType?: string
  quality?: number
  /**
   * 指定時: 描画先は必ず (0,0)〜(width,height) の canvas 全面。
   * ソース矩形 (sw,sh) の縦横比は width/height に一致させる。
   */
  outputSize?: { width: number; height: number }
}

/**
 * 画面上の点 (screenX, screenY) を、img のビットマップ座標へ変換する。
 * layoutW/visualW で transform 後の表示とレイアウト寸法を対応させる。
 */
function screenPointToSource(
  image: HTMLImageElement,
  imageRect: DOMRectReadOnly,
  screenX: number,
  screenY: number,
): { sx: number; sy: number } {
  const nw = image.naturalWidth
  const nh = image.naturalHeight
  const layoutW = image.clientWidth || image.offsetWidth
  const layoutH = image.clientHeight || image.offsetHeight
  const visualW = imageRect.width
  const visualH = imageRect.height

  if (layoutW < 1 || layoutH < 1 || visualW < 1e-6 || visualH < 1e-6) {
    throw new Error("画像のレイアウトまたは表示サイズが無効です。")
  }

  const dx = screenX - imageRect.left
  const dy = screenY - imageRect.top
  const layoutDx = (dx / visualW) * layoutW
  const layoutDy = (dy / visualH) * layoutH

  return {
    sx: layoutDx * (nw / layoutW),
    sy: layoutDy * (nh / layoutH),
  }
}

/**
 * 赤枠（cropArea）の画面上の幅に対応するソース幅（ビットマップ px）。
 */
function frameWidthToSourceWidth(
  image: HTMLImageElement,
  imageRect: DOMRectReadOnly,
  frameWidthPx: number,
): number {
  const nw = image.naturalWidth
  const layoutW = image.clientWidth || image.offsetWidth
  const visualW = imageRect.width
  if (layoutW < 1 || visualW < 1e-6) {
    throw new Error("画像のレイアウトまたは表示サイズが無効です。")
  }
  return (frameWidthPx / visualW) * layoutW * (nw / layoutW)
}

/**
 * 赤枠の左上をソース起点とし、幅を枠の幅から算出、高さは output の縦横比で決める。
 * はみ出しは canvas の drawImage がクリップ。先にベタ塗りして JPEG では黒で埋める。
 */
export function getCroppedImageBlobFromVisibleArea(
  image: HTMLImageElement,
  cropArea: HTMLElement,
  options: GetCroppedImageBlobOptions = {},
): Promise<Blob> {
  const { mimeType = "image/jpeg", quality = 0.92, outputSize } = options

  const cropRect = cropArea.getBoundingClientRect()
  const imageRect = image.getBoundingClientRect()

  if (cropRect.width < 2 || cropRect.height < 2) {
    return Promise.reject(new Error("切り抜き枠のサイズが無効です。"))
  }

  const { sx, sy } = screenPointToSource(image, imageRect, cropRect.left, cropRect.top)

  const sw = frameWidthToSourceWidth(image, imageRect, cropRect.width)
  const destAspect =
    outputSize != null
      ? outputSize.width / outputSize.height
      : cropRect.width / Math.max(cropRect.height, 1e-6)
  const sh = sw / destAspect

  const canvas = document.createElement("canvas")

  if (outputSize) {
    const { width: outW, height: outH } = outputSize
    if (outW < 1 || outH < 1) {
      return Promise.reject(new Error("outputSize の寸法が無効です。"))
    }
    canvas.width = outW
    canvas.height = outH
  } else {
    const w = Math.max(1, Math.round(sw))
    const h = Math.max(1, Math.round(sh))
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D コンテキストを取得できませんでした。"))
  }

  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const destW = canvas.width
  const destH = canvas.height
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, destW, destH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("画像の書き出しに失敗しました。"))
        }
      },
      mimeType,
      quality,
    )
  })
}
