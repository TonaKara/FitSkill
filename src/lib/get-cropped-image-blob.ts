/**
 * 画面上の img と切り抜き枠（DOM 要素）の重なりから Blob を生成する。
 * transform 付きの表示でも getBoundingClientRect 基準で自然解像度へ写す。
 */
export function getCroppedImageBlobFromVisibleArea(
  image: HTMLImageElement,
  cropArea: HTMLElement,
  mimeType: string = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
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

  const sourceX = (overlapLeft - imageRect.left) * scaleX
  const sourceY = (overlapTop - imageRect.top) * scaleY
  const sourceWidth = overlapWidth * scaleX
  const sourceHeight = overlapHeight * scaleY

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(sourceWidth))
  canvas.height = Math.max(1, Math.round(sourceHeight))

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D コンテキストを取得できませんでした。"))
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )

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
