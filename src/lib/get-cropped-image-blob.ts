import type { PixelCrop } from "react-image-crop"

/**
 * 画面上の img 要素と PixelCrop（表示座標系）から切り抜き画像の Blob を生成する。
 */
export function getCroppedImageBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  mimeType: string = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  const width = Math.max(1, Math.round(pixelCrop.width * scaleX))
  const height = Math.max(1, Math.round(pixelCrop.height * scaleY))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D コンテキストを取得できませんでした。"))
  }

  ctx.drawImage(
    image,
    Math.round(pixelCrop.x * scaleX),
    Math.round(pixelCrop.y * scaleY),
    width,
    height,
    0,
    0,
    width,
    height,
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
