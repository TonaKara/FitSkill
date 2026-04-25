"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react"
import ReactCrop, { defaultCrop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCroppedImageBlob } from "@/lib/get-cropped-image-blob"
import { SKILL_THUMBNAIL_ASPECT_RATIO } from "@/lib/skill-thumbnail"
import "./thumbnail-crop-modal.css"

/** 画像内に収まる最大の中央寄せクロップ（一覧カードと同じ 16:10） */
function maxCenteredAspectPixelCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): PixelCrop {
  const imageAspect = mediaWidth / mediaHeight
  let cropWidth: number
  let cropHeight: number
  if (imageAspect >= aspect) {
    cropHeight = mediaHeight
    cropWidth = cropHeight * aspect
  } else {
    cropWidth = mediaWidth
    cropHeight = cropWidth / aspect
  }
  return {
    unit: "px",
    x: (mediaWidth - cropWidth) / 2,
    y: (mediaHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  }
}

type ThumbnailCropModalProps = {
  open: boolean
  imageSrc: string | null
  onClose: () => void
  onConfirm: (blob: Blob) => void | Promise<void>
  /** false のときは技術的な例外メッセージを出さない */
  isAdmin?: boolean
}

const GENERIC_IMAGE_ERROR = "画像の処理に失敗しました。"

export function ThumbnailCropModal({
  open,
  imageSrc,
  onClose,
  onConfirm,
  isAdmin = false,
}: ThumbnailCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<PixelCrop>(defaultCrop)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyCropFromDisplayedImage = useCallback((img: HTMLImageElement) => {
    const w = Math.round(img.offsetWidth)
    const h = Math.round(img.offsetHeight)
    if (w < 4 || h < 4) return
    setCrop(maxCenteredAspectPixelCrop(w, h, SKILL_THUMBNAIL_ASPECT_RATIO))
  }, [])

  const onImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget
      applyCropFromDisplayedImage(img)
      requestAnimationFrame(() => {
        applyCropFromDisplayedImage(img)
        requestAnimationFrame(() => applyCropFromDisplayedImage(img))
      })
    },
    [applyCropFromDisplayedImage],
  )

  useLayoutEffect(() => {
    if (!open || !imageSrc) return
    const img = imgRef.current
    if (!img) return
    if (!img.complete || img.naturalWidth === 0) {
      setCrop(defaultCrop)
      return
    }
    applyCropFromDisplayedImage(img)
    requestAnimationFrame(() => applyCropFromDisplayedImage(img))
  }, [open, imageSrc, applyCropFromDisplayedImage])

  useEffect(() => {
    if (open && imageSrc) {
      setError(null)
      setBusy(false)
    }
  }, [open, imageSrc])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const handleConfirm = async () => {
    const image = imgRef.current
    if (!image || !crop || crop.width < 4 || crop.height < 4) {
      setError("切り抜き範囲を調整してください。")
      return
    }

    setError(null)
    setBusy(true)
    try {
      const blob = await getCroppedImageBlob(image, crop, "image/jpeg", 0.92)
      await onConfirm(blob)
      onClose()
    } catch (e) {
      if (isAdmin && e instanceof Error && e.message.trim()) {
        setError(e.message)
      } else {
        setError(GENERIC_IMAGE_ERROR)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open || !imageSrc) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thumbnail-crop-title"
    >
      <div className="thumbnail-crop-modal relative flex max-h-[92vh] w-[min(78vw,1320px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-red-500/40 bg-zinc-950 shadow-[0_0_80px_rgba(225,29,72,0.25)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 md:px-6">
          <div>
            <h2 id="thumbnail-crop-title" className="text-base font-bold text-white md:text-lg">
              サムネイルの切り抜き
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400 md:text-sm">
              枠をドラッグして位置と大きさを調整できます（一覧や詳細には枠内のみ表示されます）。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="thumbnail-crop-stage flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-zinc-900/45 px-2 py-5 sm:min-h-[min(42vh,400px)] sm:px-4 md:px-6">
          <div className="thumbnail-crop-media-shell relative mx-auto w-fit max-w-full min-w-0">
            <ReactCrop
              crop={crop}
              onChange={(next) => setCrop(next)}
              aspect={SKILL_THUMBNAIL_ASPECT_RATIO}
              minWidth={56}
              minHeight={35}
              className="thumbnail-crop-react max-w-full"
              ruleOfThirds
            >
              <img
                key={imageSrc}
                ref={imgRef}
                src={imageSrc}
                alt="切り抜き対象"
                onLoad={onImageLoad}
                className="thumbnail-crop-source block h-auto max-h-[min(72vh,860px)] w-auto max-w-full object-contain"
              />
            </ReactCrop>
          </div>
        </div>

        {error ? <p className="shrink-0 px-4 pb-2 text-center text-sm text-red-400 md:px-6">{error}</p> : null}

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-zinc-800 bg-black/40 px-4 py-4 sm:flex-row sm:justify-end md:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            className="bg-red-600 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? "処理中..." : "この範囲で決定"}
          </Button>
        </div>
      </div>
    </div>
  )
}
