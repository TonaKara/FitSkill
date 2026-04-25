"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ExternalLink } from "lucide-react"
import { ChatYoutubeRich } from "@/components/chat-youtube-rich"
import { Button } from "@/components/ui/button"
import { type LinkMessagePayload, type ZoomLinkPayload } from "@/lib/chat-link-payload"
import { cn } from "@/lib/utils"

type Props = {
  payload: LinkMessagePayload
  mine: boolean
}

function ZoomInviteCard({ payload, mine }: { payload: ZoomLinkPayload; mine: boolean }) {
  const [toastOpen, setToastOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showCopiedToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToastOpen(true)
    toastTimerRef.current = setTimeout(() => {
      setToastOpen(false)
      toastTimerRef.current = null
    }, 2000)
  }, [])

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        showCopiedToast()
      } catch {
        /* 権限・非HTTPS 等 */
      }
    },
    [showCopiedToast],
  )

  const hasPassword = Boolean(payload.password.trim())

  return (
    <>
      <div
        className={cn(
          "mt-0 rounded-xl border p-3 text-left shadow-sm",
          mine
            ? "border-red-900/60 bg-red-950/40"
            : "border-zinc-600 bg-zinc-950/80",
        )}
      >
        <p className="text-xs font-semibold text-amber-200">Zoom会議招待</p>
        <div className="mt-3 space-y-3 text-xs">
          <div className="rounded-lg border border-zinc-700/80 bg-black/20 p-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-400">ミーティングID</p>
                <p className="mt-0.5 break-all font-mono text-sm text-zinc-100">{payload.meetingId}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 shrink-0 self-start px-2.5 text-[11px] font-medium",
                  mine
                    ? "border-red-200/30 bg-red-900/40 text-red-50 hover:bg-red-900/60"
                    : "border-zinc-500 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700",
                )}
                onClick={() => void copyText(payload.meetingId)}
              >
                IDをコピー
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-700/80 bg-black/20 p-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-400">パスコード</p>
                <p className="mt-0.5 break-all font-mono text-sm text-zinc-100">
                  {hasPassword ? payload.password : "—"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPassword}
                title={hasPassword ? undefined : "パスコードが設定されていません"}
                className={cn(
                  "h-8 shrink-0 self-start px-2.5 text-[11px] font-medium",
                  mine
                    ? "border-red-200/30 bg-red-900/40 text-red-50 hover:bg-red-900/60 disabled:border-zinc-600 disabled:bg-zinc-900/50 disabled:text-zinc-500"
                    : "border-zinc-500 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40",
                )}
                onClick={() => hasPassword && void copyText(payload.password)}
              >
                パスコードをコピー
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-700/80 bg-black/20 p-2.5">
            <p className="text-[11px] font-medium text-zinc-400">参加リンク</p>
            <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-zinc-300">{payload.link}</p>
          </div>
        </div>

        <Button
          asChild
          type="button"
          size="sm"
          className={cn(
            "mt-3 w-full gap-2 font-medium",
            mine
              ? "bg-white text-red-700 hover:bg-zinc-100"
              : "border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
          )}
          variant={mine ? "default" : "secondary"}
        >
          <a href={payload.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            会議に参加
          </a>
        </Button>
      </div>

      {portalReady &&
        toastOpen &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-6 left-1/2 z-[10001] -translate-x-1/2 rounded-full border border-emerald-700/50 bg-emerald-950/95 px-4 py-2 text-[11px] font-medium text-emerald-100 shadow-lg backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            コピーしました！
          </div>,
          document.body,
        )}
    </>
  )
}

export function ChatLinkMessageCard({ payload, mine }: Props) {
  if (payload.kind === "zoom") {
    return <ZoomInviteCard payload={payload} mine={mine} />
  }

  return <ChatYoutubeRich url={payload.url} mine={mine} />
}
