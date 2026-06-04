"use client"

/**
 * チャット吹き出し内の画像表示。
 */
export function ChatImageAttachment({
  imageUrl,
}: {
  imagePath: string
  imageUrl?: string
}) {
  if (!imageUrl) {
    return (
      <div
        className="flex h-32 w-48 items-center justify-center bg-zinc-50 text-xs text-zinc-400"
        aria-busy="true"
      >
        読み込み中…
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL
    <img
      src={imageUrl}
      alt="送信された画像"
      decoding="async"
      className="block max-h-72 w-auto object-contain"
    />
  )
}
