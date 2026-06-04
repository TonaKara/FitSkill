"use client"

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { LegalPageShell } from "@/legal/_shell"
import { useTranslations } from "@/lib/i18n/useI18n"
import { GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH } from "@/lib/talk/inquiry-constants"
import { safeClientLogError } from "@/lib/safe-client-log"
import { submitGritvibInquiryAction } from "@/lib/talk/submit-gritvib-inquiry-action"

/**
 * GritVib 公開トップから辿るお問い合わせフォーム。
 *
 * 設計:
 *   - 既存の `/contact` (旧サイト用) とは独立。世界観を分けるため `LegalPageShell` で白黒に描画する。
 *   - `category` は固定値。`subject` は利用者入力（最大 40 文字）。
 *   - 送信成功時は同ページ内で受付メッセージに切り替える。URL は変えない (短い導線維持)。
 *   - Discord 通知は best-effort で、失敗しても送信成功扱いとする。
 */

const CONTENT_MAX_LENGTH = 2000

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LegalContactPage() {
  const tLegal = useTranslations("legal")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const trimmedSubject = subject.trim()
  const trimmedMessage = message.trim()
  const canSubmit =
    trimmedName.length > 0 &&
    trimmedEmail.length > 0 &&
    isValidEmail(trimmedEmail) &&
    trimmedSubject.length > 0 &&
    trimmedSubject.length <= GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH &&
    trimmedMessage.length > 0 &&
    trimmedMessage.length <= CONTENT_MAX_LENGTH

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !canSubmit) {
      return
    }
    setError(null)

    if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
      setError(tLegal("contactErrorRequired"))
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      setError(tLegal("contactErrorEmail"))
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitGritvibInquiryAction({
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        content: trimmedMessage,
      })

      if (!result.ok) {
        if (result.reason === "invalid_email") {
          setError(tLegal("contactErrorEmail"))
        } else if (result.reason === "subject_too_long") {
          setError(
            tLegal("contactErrorSubjectTooLong", {
              max: GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH,
            }),
          )
        } else if (result.reason === "content_too_long") {
          setError(tLegal("contactErrorSubmit"))
        } else {
          setError(tLegal("contactErrorSubmit"))
        }
        return
      }

      setSubmitted(true)
    } catch (err) {
      safeClientLogError("[legal/contact] submit failed")
      setError(tLegal("contactErrorSubmit"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <LegalPageShell
        title={tLegal("contactSuccessTitle")}
        topLinkLabel={tLegal("backToHome")}
        fit
      >
        <div className="space-y-4 text-sm leading-relaxed text-zinc-700 md:text-base">
          <p>{tLegal("contactSuccessBody")}</p>
        </div>
      </LegalPageShell>
    )
  }

  return (
    <LegalPageShell
      title={tLegal("contactTitle")}
      topLinkLabel={tLegal("backToHome")}
      fit
    >
      {/*
        フォーム全体を flex 縦配置にし、`flex-1 min-h-0` の textarea ラッパーで残り高さを取る。
        それ以外の要素 (説明文・各 input・送信ボタン) は `flex-none` で固定高さを維持し、
        入力内容が膨らんでも画面外にはみ出さず、textarea 内部のスクロールで完結させる。
      */}
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4"
        noValidate
      >
        <p className="flex-none text-xs leading-relaxed text-zinc-700 sm:text-sm md:text-base">
          {tLegal("contactDescription")}
        </p>

        <div className="flex-none space-y-1.5">
          <label
            htmlFor="legal-contact-name"
            className="block text-xs font-medium text-black sm:text-sm"
          >
            {tLegal("contactNameLabel")}
          </label>
          <input
            id="legal-contact-name"
            type="text"
            required
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
        </div>

        <div className="flex-none space-y-1.5">
          <label
            htmlFor="legal-contact-email"
            className="block text-xs font-medium text-black sm:text-sm"
          >
            {tLegal("contactEmailLabel")}
          </label>
          <input
            id="legal-contact-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
        </div>

        <div className="flex-none space-y-1.5">
          <label
            htmlFor="legal-contact-subject"
            className="block text-xs font-medium text-black sm:text-sm"
          >
            {tLegal("contactSubjectLabel")}
          </label>
          <input
            id="legal-contact-subject"
            type="text"
            required
            maxLength={GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={isSubmitting}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <label
            htmlFor="legal-contact-message"
            className="flex-none text-xs font-medium text-black sm:text-sm"
          >
            {tLegal("contactMessageLabel")}
          </label>
          {/*
            min-h-0 + flex-1 で残り高さを占有。`resize-none` でユーザー操作によるリサイズ禁止。
            内容が枠より長くなれば `overflow-y-auto` で textarea 内部だけがスクロールする。
          */}
          <textarea
            id="legal-contact-message"
            required
            maxLength={CONTENT_MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSubmitting}
            className="block min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
        </div>

        {error ? (
          <p className="flex-none text-xs text-red-600 sm:text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-none justify-center pt-1">
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="inline-flex h-11 w-full max-w-xs items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:h-12 sm:max-w-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {tLegal("contactSubmitting")}
              </>
            ) : (
              tLegal("contactSubmit")
            )}
          </button>
        </div>
      </form>
    </LegalPageShell>
  )
}
