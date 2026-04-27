"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence" as const
const SIGNED_URL_TTL_SEC = 60

type DisputeEvidenceImageProps = {
  /** Storage のオブジェクトキー、または http(s) の画像 URL */
  pathOrUrl?: string | null
  alt?: string
  className?: string
  /**
   * true: チャット用 120×120 サムネイル＋クリックで拡大モーダル
   * false/省略: 管理画面などインライン表示（最大高さ 300px）
   */
  chatThumbnail?: boolean
}

/**
 * 異議申し立ての証拠画像: パスなら createSignedUrl、URL ならそのまま表示
 */
export function DisputeEvidenceImage({
  pathOrUrl,
  alt = "証拠画像",
  className,
  chatThumbnail = false,
}: DisputeEvidenceImageProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
  }, [])

  useEffect(() => {
    if (!lightboxOpen) {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightboxOpen, closeLightbox])

  useEffect(() => {
    const raw = pathOrUrl?.trim() ?? ""
    if (!raw) {
      setSrc(null)
      setError(null)
      setLoading(false)
      setLightboxOpen(false)
      return
    }

    let cancelled = false

    if (/^https?:\/\//i.test(raw)) {
      setSrc(raw)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setSrc(null)

    void supabase.storage
      .from(DISPUTE_EVIDENCE_BUCKET)
      .createSignedUrl(raw, SIGNED_URL_TTL_SEC)
      .then(
        (result: { data: { signedUrl: string } | null; error: { message: string } | null }) => {
        const { data, error: signError } = result
        if (cancelled) {
          return
        }
        if (signError || !data?.signedUrl) {
          console.error("[DisputeEvidenceImage] createSignedUrl 失敗", {
            bucket: DISPUTE_EVIDENCE_BUCKET,
            path: raw,
            message: signError?.message,
            error: signError,
          })
          setError("画像を読み込めませんでした")
          setSrc(null)
        } else {
          setSrc(data.signedUrl)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pathOrUrl, supabase])

  const trimmed = pathOrUrl?.trim() ?? ""
  if (!trimmed) {
    return null
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50",
          chatThumbnail ? "h-[120px] w-[120px]" : "max-w-full flex-col gap-2 py-10",
          className,
        )}
        aria-busy="true"
        aria-label="証拠画像を読み込み中"
      >
        {chatThumbnail ? (
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
        ) : (
          <>
            <div className="h-24 w-full max-w-md animate-pulse rounded-md bg-zinc-800/80" />
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-red-500" />
          </>
        )}
      </div>
    )
  }

  if (error || !src) {
    return (
      <p className={cn("text-sm text-amber-300", className)} role="alert">
        {error ?? "画像を表示できません"}
      </p>
    )
  }

  if (chatThumbnail) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className={cn(
            "inline-block overflow-hidden rounded-lg border border-zinc-600 bg-zinc-900/80 p-0 text-left shadow-sm ring-offset-2 ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
            className,
          )}
          aria-label={`${alt}を拡大表示`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="block max-h-[120px] max-w-[120px] cursor-pointer rounded-[8px] object-cover"
          />
        </button>

        {lightboxOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="証拠画像の拡大表示"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-4 top-4 rounded-full border border-zinc-600 bg-zinc-900 p-2 text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className="max-h-[80vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-[80vh] max-w-[90vw] object-contain"
              />
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/50 p-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 署名付き URL の動的表示 */}
      <img
        src={src}
        alt={alt}
        className="mx-auto block max-h-[300px] w-full max-w-full object-contain"
      />
    </div>
  )
}
