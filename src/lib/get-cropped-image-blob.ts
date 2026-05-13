export type GetCroppedImageBlobOptions = {
  mimeType?: string
  quality?: number
  /**
   * 指定時はこのピクセル寸法の canvas に描画する（アスペクトはクロップ枠と一致させること）。
   * 未指定時はソース上の切り抜きを整数ピクセルに丸めつつ、枠と同じ縦横比を維持する。
   */
  outputSize?: { width: number; height: number }
}

function clampSourceRect(
  x: number,
  y: number,
  w: number,
  h: number,
  naturalWidth: number,
  naturalHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = Math.max(0, Math.min(x, naturalWidth - 1))
  const sy = Math.max(0, Math.min(y, naturalHeight - 1))
  const sw = Math.max(1, Math.min(w, naturalWidth - sx))
  const sh = Math.max(1, Math.min(h, naturalHeight - sy))
  return { sx, sy, sw, sh }
}

/**
 * 画面上の img と切り抜き枠（DOM 要素）の重なりから Blob を生成する。
 * transform 付きの表示でも getBoundingClientRect 基準で自然解像度へ写す。
 */
export function getCroppedImageBlobFromVisibleArea(
  image: HTMLImageElement,
  cropArea: HTMLElement,
  options: GetCroppedImageBlobOptions = {},
): Promise<Blob> {
  const { mimeType = "image/jpeg", quality = 0.92, outputSize } = options

  const cropRect = cropArea.getBoundingClientRect()
  const imageRect = image.getBoundingClientRect()

  const overlapLeft = Math.max(cropRect.left, imageRect.left)
  const overlapTop = Math.max(cropRect.top, imageRect.top)
  const overlapRight = Math.min(cropRect.right, imageRect.right)
  const overlapBottom = Math.min(cropRect.bottom, imageRect.bottom)

  const overlapWidth = overlapRight - overlapLeft
  const overlapHeight = overlapBottom - overlapTop

  if (overlapWidth < 2 || overlapHeight < 2) {
    return Promise.reject(new Error("切り抜き範囲が画像と重なっていません。"))
  }

  const scaleX = image.naturalWidth / imageRect.width
  const scaleY = image.naturalHeight / imageRect.height
  // PinchZoom は等方スケール。サブピクセルや DPR で scaleX/scaleY が僅差にずれる場合は平均で一本化
  const scale =
    Math.abs(scaleX - scaleY) <= Math.max(scaleX, scaleY) * 0.002 ? (scaleX + scaleY) / 2 : Math.sqrt(scaleX * scaleY)

  const sourceX = (overlapLeft - imageRect.left) * scale
  const sourceY = (overlapTop - imageRect.top) * scale
  const sourceWidth = overlapWidth * scale
  const sourceHeight = overlapHeight * scale

  const { sx, sy, sw, sh } = clampSourceRect(
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    image.naturalWidth,
    image.naturalHeight,
  )

  const canvas = document.createElement("canvas")

  if (outputSize) {
    canvas.width = outputSize.width
    canvas.height = outputSize.height
  } else {
    const frameAspect = overlapWidth / overlapHeight
    let outW = Math.max(1, Math.round(sw))
    let outH = Math.max(1, Math.round(sh))
    const outAspect = outW / outH
    if (Math.abs(outAspect - frameAspect) > 1e-5) {
      if (outAspect > frameAspect) {
        outW = Math.max(1, Math.round(outH * frameAspect))
      } else {
        outH = Math.max(1, Math.round(outW / frameAspect))
      }
    }
    canvas.width = outW
    canvas.height = outH
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D コンテキストを取得できませんでした。"))
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

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
