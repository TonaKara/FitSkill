"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Info, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isValidDiscordUserIdInput,
  type LinkMessagePayload,
} from "@/lib/chat-link-payload"
import { chatUi } from "@/lib/chat-ui"
import { useTranslations } from "@/lib/i18n/useI18n"
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
  const tModal = useTranslations("chatLink.modal")
  const tErr = useTranslations("chatLink.modal.errors")
  const tShared = useTranslations("chatLink")
  const tAria = useTranslations("aria")
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
      setLocalError(tErr("meetingIdRequired"))
      return
    }
    if (!link) {
      setLocalError(tErr("linkRequired"))
      return
    }
    if (!isValidHttpUrl(link)) {
      setLocalError(tErr("linkInvalid"))
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
      setLocalError(tErr("youtubeUrlRequired"))
      return
    }
    if (!isValidHttpUrl(url)) {
      setLocalError(tErr("urlInvalid"))
      return
    }
    await onConfirm({ kind: "youtube", url })
  }

  const submitDiscord = async () => {
    setLocalError(null)
    const userId = discordUserId.trim()
    if (!userId) {
      setLocalError(tErr("discordUserIdRequired"))
      return
    }
    if (!isValidDiscordUserIdInput(userId)) {
      setLocalError(tErr("discordUserIdInvalid"))
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
            {step === "pick" && tModal("pickTitle")}
            {step === "zoom" && tModal("zoomTitle")}
            {step === "youtube" && tModal("youtubeTitle")}
            {step === "discord" && tModal("discordTitle")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", chatUi.ghostBtn)}
            disabled={busy}
            onClick={onClose}
            aria-label={tAria("close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {step === "pick" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{tModal("pickDescription")}</p>
            {allowZoom ? (
              <>
                <Button
                  type="button"
                  className="h-12 w-full bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => setStep("zoom")}
                  disabled={busy}
                >
                  {tModal("zoomTitle")}
                </Button>
                <Button
                  type="button"
                  className="h-12 w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
                  onClick={() => setStep("discord")}
                  disabled={busy}
                >
                  {tModal("discordTitle")}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              className="h-12 w-full bg-red-700 text-white hover:bg-red-600"
              onClick={() => setStep("youtube")}
              disabled={busy}
            >
              {tModal("youtubeTitle")}
            </Button>
          </div>
        ) : null}

        {step === "zoom" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{tModal("zoom.meetingIdLabel")}</span>
              <Input
                value={zoomMeetingId}
                onChange={(e) => setZoomMeetingId(e.target.value)}
                placeholder={tModal("zoom.meetingIdPlaceholder")}
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{tModal("zoom.passcodeLabel")}</span>
              <Input
                value={zoomPassword}
                onChange={(e) => setZoomPassword(e.target.value)}
                placeholder={tModal("zoom.passcodePlaceholder")}
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{tModal("zoom.joinLinkLabel")}</span>
              <Input
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder={tModal("zoom.joinLinkPlaceholder")}
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
                {tModal("back")}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-red-600 text-white hover:bg-red-500"
                disabled={busy}
                onClick={() => void submitZoom()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tModal("send")}
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
              <p className="text-xs leading-relaxed">{tShared("discordServerInviteNotice")}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{tModal("discord.userIdLabel")}</span>
              <Input
                value={discordUserId}
                onChange={(e) => setDiscordUserId(e.target.value)}
                placeholder={tModal("discord.userIdPlaceholder")}
                disabled={busy}
                className={chatUi.input}
                autoComplete="off"
                maxLength={37}
              />
            </label>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {tModal("discord.userIdHint")}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className={cn("flex-1", chatUi.modalCancel)}
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                {tModal("back")}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#5865F2] text-white hover:bg-[#4752C4]"
                disabled={busy}
                onClick={() => void submitDiscord()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tModal("send")}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "youtube" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{tModal("youtube.urlLabel")}</span>
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={tModal("youtube.urlPlaceholder")}
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
                  {tModal("back")}
                </Button>
              ) : null}
              <Button
                type="button"
                className={`${showPickBackOnYoutube ? "flex-1" : "w-full"} bg-red-600 text-white hover:bg-red-500`}
                disabled={busy}
                onClick={() => void submitYoutube()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tModal("send")}
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
