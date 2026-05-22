"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type SyntheticEvent,
} from "react"
import PinchZoom, { make3dTransformValue, type UpdateAction } from "react-quick-pinch-zoom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCroppedImageBlobFromVisibleArea } from "@/lib/get-cropped-image-blob"
import { SKILL_THUMBNAIL_ASPECT_RATIO } from "@/lib/skill-thumbnail"
import { useTranslations } from "@/lib/i18n/useI18n"
import "./thumbnail-crop-modal.css"

/** 枠の最大幅・高さは thumbnail-crop-modal.css の --crop-frame-max-w / --crop-frame-max-h と揃える */
const MIN_ZOOM = 1
const MAX_ZOOM_CAP = 6
const MIN_ZOOM_HEADROOM = 2.5
const ZOOM_SLIDER_STEP = 0.01

/** 初期表示は枠内に全体が収まる contain（切り出しは getCroppedImageBlobFromVisibleArea が枠左上＋固定比率で行う） */
function applyBaseImageLayout(image: HTMLImageElement, viewport: DOMRect) {
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (naturalWidth < 1 || naturalHeight < 1 || viewport.width < 4 || viewport.height < 4) {
    return
  }

  const fitScale = Math.min(viewport.width / naturalWidth, viewport.height / naturalHeight)
  image.style.width = `${naturalWidth * fitScale}px`
  image.style.height = `${naturalHeight * fitScale}px`
}

function computeMaxZoom(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (naturalWidth < 1 || naturalHeight < 1 || containerWidth < 1 || containerHeight < 1) {
    return MAX_ZOOM_CAP
  }

  const fitScale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
  const fitWidth = naturalWidth * fitScale
  const fitHeight = naturalHeight * fitScale

  return Math.min(
    MAX_ZOOM_CAP,
    Math.max(MIN_ZOOM_HEADROOM, Math.max(naturalWidth / fitWidth, naturalHeight / fitHeight)),
  )
}

type ThumbnailCropModalProps = {
  open: boolean
  imageSrc: string | null
  onClose: () => void
  onConfirm: (blob: Blob) => void | Promise<void>
  /** false のときは技術的な例外メッセージを出さない */
  isAdmin?: boolean
  /**
   * skill … クロップ枠を 16:10 に固定（呼び出し側で比率を変更不可。出力の横長を統一）
   * avatar … 1:1 固定（プロフィールアイコン用）
   */
  cropShape?: "skill" | "avatar"
  /** 指定時、canvas をこのピクセル寸法に正規化（枠のアスペクトと一致させること） */
  outputPixelSize?: { width: number; height: number }
  heading?: string
  subheading?: string
}

export function ThumbnailCropModal({
  open,
  imageSrc,
  onClose,
  onConfirm,
  isAdmin = false,
  cropShape = "skill",
  outputPixelSize,
  heading,
  subheading,
}: ThumbnailCropModalProps) {
  const t = useTranslations("thumbnailCropModal")
  const tAria = useTranslations("aria")
  const resolvedHeading = heading ?? t("headingDefault")
  const resolvedSubheading = subheading ?? t("subheadingDefault")
  /** ユーザーが変更できない固定比率（react-quick-pinch-zoom は等方ズームのみで、枠比率はここで決まる） */
  const fixedAspectRatio = cropShape === "avatar" ? 1 : SKILL_THUMBNAIL_ASPECT_RATIO

  const viewportRef = useRef<HTMLDivElement>(null)
  /** ビューポート＝ fixedAspectRatio の矩形そのものを書き出す */
  const imgRef = useRef<HTMLImageElement>(null)
  const pinchZoomRef = useRef<PinchZoom>(null)
  const pinchTransformRef = useRef({ x: 0, y: 0, zoomFactor: MIN_ZOOM })
  const [mediaReady, setMediaReady] = useState(false)
  const [maxZoom, setMaxZoom] = useState(MAX_ZOOM_CAP)
  const [zoomFactor, setZoomFactor] = useState(MIN_ZOOM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const viewportStyle = {
    "--thumbnail-crop-aspect": String(fixedAspectRatio),
  } as CSSProperties

  const syncZoomLimits = useCallback(() => {
    const viewport = viewportRef.current
    const image = imgRef.current
    if (!viewport || !image || image.naturalWidth < 1 || image.naturalHeight < 1) {
      return
    }

    const { width, height } = viewport.getBoundingClientRect()
    if (width < 4 || height < 4) {
      return
    }

    setMaxZoom(computeMaxZoom(image.naturalWidth, image.naturalHeight, width, height))
  }, [])

  const handlePinchZoomUpdate = useCallback(({ x, y, scale }: UpdateAction) => {
    const image = imgRef.current
    if (!image) {
      return
    }
    image.style.transform = make3dTransformValue({ x, y, scale })

    // react-quick-pinch-zoom の `scale` は既にライブラリ内部で
    // "1.0 = 等倍（fit 表示）" として正規化された値なので、そのまま zoomFactor として使う。
    // （旧コードはここで `scale / initialScale` の自前正規化を行っていたが、
    //   スライダー操作で onUpdate が初めて発火するケースでは
    //   `initialScale` がユーザーの設定値で固定されてしまい、ドラッグ時に
    //   表示倍率が 1.0 に戻る／位置だけ動いて拡大が解除される、という不具合があった）
    const clampedZoomFactor = Math.min(maxZoom, Math.max(MIN_ZOOM, scale))
    pinchTransformRef.current = { x, y, zoomFactor: clampedZoomFactor }
    setZoomFactor(clampedZoomFactor)
  }, [maxZoom])

  const handleZoomSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextZoomFactor = Number(event.target.value)
    if (!Number.isFinite(nextZoomFactor)) {
      return
    }

    const clampedZoomFactor = Math.min(maxZoom, Math.max(MIN_ZOOM, nextZoomFactor))
    setZoomFactor(clampedZoomFactor)
    pinchTransformRef.current.zoomFactor = clampedZoomFactor
    pinchZoomRef.current?.scaleTo({
      x: pinchTransformRef.current.x,
      y: pinchTransformRef.current.y,
      scale: clampedZoomFactor,
      animated: false,
    })
  }, [maxZoom])

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget
      const viewport = viewportRef.current
      image.style.transform = ""
      if (viewport) {
        applyBaseImageLayout(image, viewport.getBoundingClientRect())
      }
      pinchTransformRef.current = { x: 0, y: 0, zoomFactor: MIN_ZOOM }
      setZoomFactor(MIN_ZOOM)
      setMediaReady(image.naturalWidth > 0 && image.naturalHeight > 0)
      requestAnimationFrame(() => {
        if (viewport) {
          applyBaseImageLayout(image, viewport.getBoundingClientRect())
        }
        syncZoomLimits()
        requestAnimationFrame(syncZoomLimits)
      })
    },
    [syncZoomLimits],
  )

  useEffect(() => {
    if (!open || !imageSrc) {
      return
    }

    setError(null)
    setBusy(false)
    setMediaReady(false)
    setMaxZoom(MAX_ZOOM_CAP)
    setZoomFactor(MIN_ZOOM)
    pinchTransformRef.current = { x: 0, y: 0, zoomFactor: MIN_ZOOM }
  }, [open, imageSrc, cropShape])

  useEffect(() => {
    setZoomFactor((current) => Math.min(maxZoom, Math.max(MIN_ZOOM, current)))
  }, [maxZoom])

  useEffect(() => {
    if (!open || !imageSrc) {
      return
    }

    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const preventWheelScroll = (event: WheelEvent) => {
      event.preventDefault()
    }

    viewport.addEventListener("wheel", preventWheelScroll, { passive: false })

    const observer = new ResizeObserver(() => {
      syncZoomLimits()
    })
    observer.observe(viewport)

    return () => {
      viewport.removeEventListener("wheel", preventWheelScroll)
      observer.disconnect()
    }
  }, [open, imageSrc, cropShape, mediaReady, syncZoomLimits])

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
    const viewport = viewportRef.current
    if (!image || !viewport || !mediaReady) {
      setError(t("errors.imageNotReady"))
      return
    }

    setError(null)
    setBusy(true)
    try {
      const blob = await getCroppedImageBlobFromVisibleArea(image, viewport, {
        mimeType: "image/jpeg",
        quality: 0.92,
        outputSize: outputPixelSize,
      })
      await onConfirm(blob)
      onClose()
    } catch (e) {
      if (isAdmin && e instanceof Error && e.message.trim()) {
        setError(e.message)
      } else {
        setError(t("errors.genericFailure"))
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
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="thumbnail-crop-title"
    >
      <div className="thumbnail-crop-modal relative my-2 flex max-h-[96svh] w-[min(92vw,1320px)] min-w-0 flex-col overflow-hidden rounded-2xl border border-red-500/40 bg-zinc-950 shadow-[0_0_80px_rgba(230,74,25,0.25)] sm:my-0 sm:w-[min(78vw,1320px)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
          <div>
            <h2 id="thumbnail-crop-title" className="text-base font-bold text-white md:text-lg">
              {resolvedHeading}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400 md:text-sm">{resolvedSubheading}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label={tAria("close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="thumbnail-crop-stage flex min-h-0 flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-zinc-900/45 px-2 pb-4 pt-4 max-sm:pb-3 max-sm:pt-3 sm:min-h-[min(42vh,400px)] sm:px-4 sm:pb-6 sm:pt-8 md:px-6">
          <div className="thumbnail-crop-media-shell relative mx-auto mt-1 flex w-full min-w-0 max-w-full flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div
              ref={viewportRef}
              data-crop-shape={cropShape}
              className="thumbnail-crop-viewport relative mx-auto overflow-hidden bg-black/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={viewportStyle}
            >
              <PinchZoom
                ref={pinchZoomRef}
                key={`${imageSrc}:${cropShape}`}
                minZoom={MIN_ZOOM}
                maxZoom={maxZoom}
                wheelScaleFactor={900}
                draggableUnZoomed
                shouldInterceptWheel={() => false}
                containerProps={{ className: "thumbnail-crop-pinch absolute inset-0" }}
                onUpdate={handlePinchZoomUpdate}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ローカル blob URL の切り抜きプレビュー */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt={t("altCropTarget")}
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="thumbnail-crop-source block max-w-none select-none"
                />
              </PinchZoom>
              <div className="thumbnail-crop-frame pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="thumbnail-crop-grid absolute inset-0" />
              </div>
            </div>
            <div className="flex w-full max-w-[min(100%,560px)] flex-row items-center gap-3 px-1 text-zinc-300 max-sm:mt-0.5 sm:mt-3 sm:w-auto sm:min-w-[12rem] md:min-w-[14rem]">
              <label htmlFor="thumbnail-crop-zoom" className="shrink-0 text-xs text-zinc-400">
                {t("zoomLabel")}
              </label>
              <input
                id="thumbnail-crop-zoom"
                type="range"
                min={MIN_ZOOM}
                max={maxZoom}
                step={ZOOM_SLIDER_STEP}
                value={zoomFactor}
                disabled={!mediaReady}
                onChange={handleZoomSliderChange}
                className="thumbnail-crop-zoom-slider min-w-0 flex-1"
              />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                {Math.round(zoomFactor * 100)}%
              </span>
            </div>
          </div>
        </div>

        {error ? <p className="shrink-0 px-4 pb-2 text-center text-sm text-red-400 md:px-6">{error}</p> : null}

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-4 py-4 sm:flex-row sm:justify-end md:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !mediaReady}
            className="bg-red-600 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? t("processing") : t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  )
}
