"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Info, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DISCORD_LINK_SERVER_INVITE_NOTICE,
  isValidDiscordUserIdInput,
  type LinkMessagePayload,
} from "@/lib/chat-link-payload"
import { chatUi } from "@/lib/chat-ui"
import { cn } from "@/lib/utils"

type Step = "pick" | "zoom" | "youtube" | "discord"

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
  allowZoom?: boolean
}

export function ChatLinkIntegrationModal({ open, onClose, onConfirm, busy, allowZoom = true }: Props) {
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>("pick")
  const [zoomMeetingId, setZoomMeetingId] = useState("")
  const [zoomPassword, setZoomPassword] = useState("")
  const [zoomLink, setZoomLink] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [discordUserId, setDiscordUserId] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const showPickBackOnYoutube = allowZoom

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
      setDiscordUserId("")
      setLocalError(null)
    }
  }, [open])

  useEffect(() => {
    if (!allowZoom && (step === "zoom" || step === "discord")) {
      setStep("youtube")
    }
  }, [allowZoom, step])

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

  const submitDiscord = async () => {
    setLocalError(null)
    const userId = discordUserId.trim()
    if (!userId) {
      setLocalError("Discord のユーザー名（ID）を入力してください。")
      return
    }
    if (!isValidDiscordUserIdInput(userId)) {
      setLocalError("ユーザー名（ID）の形式が正しくありません。")
      return
    }
    await onConfirm({ kind: "discord", userId })
  }

  return createPortal(
    <div
      className={chatUi.modalOverlayHigh}
      role="presentation"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-link-modal-title"
        className={chatUi.modalMd}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="chat-link-modal-title" className={chatUi.modalTitleSm}>
            {step === "pick" && "外部ツール連携"}
            {step === "zoom" && "Zoom連携"}
            {step === "youtube" && "YouTube連携"}
            {step === "discord" && "Discord連携"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", chatUi.ghostBtn)}
            disabled={busy}
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {step === "pick" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">連携するサービスを選んでください。</p>
            {allowZoom ? (
              <>
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
                  className="h-12 w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
                  onClick={() => setStep("discord")}
                  disabled={busy}
                >
                  Discord連携
                </Button>
              </>
            ) : null}
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
              <span className="mb-1 block text-xs text-muted-foreground">ミーティングID</span>
              <Input
                value={zoomMeetingId}
                onChange={(e) => setZoomMeetingId(e.target.value)}
                placeholder="000 0000 0000"
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">パスコード</span>
              <Input
                value={zoomPassword}
                onChange={(e) => setZoomPassword(e.target.value)}
                placeholder="000000"
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">参加リンク</span>
              <Input
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", chatUi.modalCancel)}
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

        {step === "discord" ? (
          <div className="space-y-3">
            <div
              className={cn(
                "flex gap-2 rounded-lg border border-amber-500/35 px-3 py-2.5",
                chatUi.statusAmber,
              )}
              role="note"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
              <p className="text-xs leading-relaxed">{DISCORD_LINK_SERVER_INVITE_NOTICE}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Discord ユーザー名（ID）</span>
              <Input
                value={discordUserId}
                onChange={(e) => setDiscordUserId(e.target.value)}
                placeholder="例: gritvib_user"
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
                maxLength={37}
              />
            </label>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              フレンド追加用のユーザー名を共有してください。サーバー招待リンクの送信はできません。
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", chatUi.modalCancel)}
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                戻る
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4]"
                disabled={busy}
                onClick={() => void submitDiscord()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "送信"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "youtube" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">動画 URL</span>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 pt-2">
              {showPickBackOnYoutube ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn("flex-1", chatUi.modalCancel)}
                  disabled={busy}
                  onClick={() => setStep("pick")}
                >
                  戻る
                </Button>
              ) : null}
              <Button
                type="button"
                className={`${showPickBackOnYoutube ? "flex-1" : "w-full"} bg-red-600 text-white hover:bg-red-500`}
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
