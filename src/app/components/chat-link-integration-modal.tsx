"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LinkMessagePayload } from "@/lib/chat-link-payload"

type Step = "pick" | "zoom" | "youtube"

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (payload: LinkMessagePayload) => void | Promise<void>
  busy?: boolean
}

export function ChatLinkIntegrationModal({ open, onClose, onConfirm, busy }: Props) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>("pick")
  const [zoomMeetingId, setZoomMeetingId] = useState("")
  const [zoomPassword, setZoomPassword] = useState("")
  const [zoomLink, setZoomLink] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setStep("pick")
      setZoomMeetingId("")
      setZoomPassword("")
      setZoomLink("")
      setYoutubeUrl("")
      setLocalError(null)
    }
  }, [open])

  if (!mounted || !open) {
    return null
  }

  const handleBackdrop = () => {
    if (!busy) {
      onClose()
    }
  }

  const submitZoom = async () => {
    setLocalError(null)
    const meetingId = zoomMeetingId.trim()
    const link = zoomLink.trim()
    if (!meetingId) {
      setLocalError("ミーティングIDを入力してください。")
      return
    }
    if (!link) {
      setLocalError("リンクを入力してください。")
      return
    }
    if (!isValidHttpUrl(link)) {
      setLocalError("リンクは有効な URL 形式で入力してください。")
      return
    }
    await onConfirm({
      kind: "zoom",
      meetingId,
      password: zoomPassword,
      link,
    })
  }

  const submitYoutube = async () => {
    setLocalError(null)
    const url = youtubeUrl.trim()
    if (!url) {
      setLocalError("動画の URL を入力してください。")
      return
    }
    if (!isValidHttpUrl(url)) {
      setLocalError("URL の形式が正しくありません。")
      return
    }
    await onConfirm({ kind: "youtube", url })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/60 p-4"
      role="presentation"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-link-modal-title"
        className="my-auto w-full max-w-md shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="chat-link-modal-title" className="text-base font-semibold text-white">
            {step === "pick" && "外部ツール連携"}
            {step === "zoom" && "Zoom連携"}
            {step === "youtube" && "YouTube連携"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            disabled={busy}
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {step === "pick" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-400">連携するサービスを選んでください。</p>
            <Button
              type="button"
              className="h-12 w-full bg-blue-600 text-white hover:bg-blue-500"
              onClick={() => setStep("zoom")}
              disabled={busy}
            >
              Zoom連携
            </Button>
            <Button
              type="button"
              className="h-12 w-full bg-red-700 text-white hover:bg-red-600"
              onClick={() => setStep("youtube")}
              disabled={busy}
            >
              YouTube連携
            </Button>
          </div>
        ) : null}

        {step === "zoom" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">ミーティングID</span>
              <Input
                value={zoomMeetingId}
                onChange={(e) => setZoomMeetingId(e.target.value)}
                placeholder="000 0000 0000"
                disabled={busy}
                className="border-zinc-600 bg-zinc-900 text-zinc-100"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">パスコード</span>
              <Input
                value={zoomPassword}
                onChange={(e) => setZoomPassword(e.target.value)}
                placeholder="000000"
                disabled={busy}
                className="border-zinc-600 bg-zinc-900 text-zinc-100"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">参加リンク</span>
              <Input
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
                disabled={busy}
                className="border-zinc-600 bg-zinc-900 text-zinc-100"
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-200"
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                戻る
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 text-white hover:bg-red-500"
                disabled={busy}
                onClick={() => void submitZoom()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "送信"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "youtube" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">動画 URL</span>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={busy}
                className="border-zinc-600 bg-zinc-900 text-zinc-100"
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-200"
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                戻る
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 text-white hover:bg-red-500"
                disabled={busy}
                onClick={() => void submitYoutube()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "送信"}
              </Button>
            </div>
          </div>
        ) : null}

        {localError ? <p className="mt-3 text-center text-xs text-red-400">{localError}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
