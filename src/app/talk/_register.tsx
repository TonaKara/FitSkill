"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { TalkAuthShell } from "@/talk/_auth-shell"
import { TalkPasswordField } from "@/talk/_password-field"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { safeClientLogError } from "@/lib/safe-client-log"
import {
  buildAuthCallbackRedirectUrl,
  clearSignupVerificationResent,
  GRITVIB_SIGNUP_CONFIRMATION_NEXT_PATH,
  hasSignupVerificationBeenResent,
  markSignupVerificationResent,
  persistSignupPendingVerificationEmail,
} from "@/lib/auth-email-flow"

/**
 * GritVib (人間チャットサービス) の新規登録画面。
 *
 * フロー:
 *   1. メールアドレス / パスワードのみ入力
 *   2. Supabase Auth `signUp` のあと Resend 経由で確認メールを送信 (`/auth/callback?next=/talk/onboard`)
 *   3. メール確認後の初回ログインで `/talk/onboard` へ誘導し、そこでニックネームを決める
 *   4. signUp 完了後はメール確認待ち panel を表示
 */

const PASSWORD_MIN_LENGTH = 8

type RegisterPhase = "input" | "submitting" | "verification_sent"

export function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [phase, setPhase] = useState<RegisterPhase>("input")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const isSubmitting = phase === "submitting"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    setErrorMessage(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!isValidEmailLike(trimmedEmail)) {
      setErrorMessage("メールアドレスの形式が正しくありません。")
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(`パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で設定してください。`)
      return
    }
    if (password !== passwordConfirm) {
      setErrorMessage("確認用パスワードが一致しません。")
      return
    }

    setPhase("submitting")

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: buildAuthCallbackRedirectUrl("/talk/onboard"),
        },
      })

      if (error) {
        safeClientLogError("[talk/register] signUp failed")
        setErrorMessage(translateSignUpError(error.message))
        setPhase("input")
        return
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      persistSignupPendingVerificationEmail(trimmedEmail)
      clearSignupVerificationResent()

      const mailResult = await requestSignupConfirmationEmail(trimmedEmail, trimmedEmail)
      setPhase("verification_sent")
      if (!mailResult.delivered) {
        setErrorMessage(mailResult.message)
      }
    } catch (err) {
      safeClientLogError("[talk/register] unexpected error")
      setErrorMessage("登録に失敗しました。時間をおいて再度お試しください。")
      setPhase("input")
    }
  }

  if (phase === "verification_sent") {
    return (
      <VerificationSentPanel
        registeredEmail={email.trim().toLowerCase()}
        initialDeliveryError={errorMessage}
        onClearInitialError={() => setErrorMessage(null)}
      />
    )
  }

  return (
    <TalkAuthShell>
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-zinc-500 hover:text-zinc-900"
          >
            GritVib
          </Link>
          <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">はじめる</h1>
          <p className="mt-2 text-xs text-zinc-600 sm:text-sm">
            メールアドレスとパスワードでアカウントを作成します。ニックネームは初回ログイン後に決めます。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <Field
            id="register-email"
            label="メールアドレス"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            required
          />
          <TalkPasswordField
            id="register-password"
            label="パスワード"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={`${PASSWORD_MIN_LENGTH} 文字以上`}
            disabled={isSubmitting}
            required
          />
          <TalkPasswordField
            id="register-password-confirm"
            label="パスワード (確認)"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            disabled={isSubmitting}
            required
          />

          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                送信中…
              </>
            ) : (
              "アカウントを作成"
            )}
          </button>
          <p className="text-center text-sm text-zinc-600">
            アカウントをお持ちですか？{" "}
            <Link
              href="/talk/login"
              className="text-black underline-offset-4 hover:underline"
            >
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </TalkAuthShell>
  )
}

async function requestSignupConfirmationEmail(
  email: string,
  previousEmail: string,
): Promise<{ delivered: boolean; message: string }> {
  try {
    const response = await fetch("/api/auth/resend-signup-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        previousEmail,
        next: GRITVIB_SIGNUP_CONFIRMATION_NEXT_PATH,
      }),
    })
    const body = (await response.json().catch(() => null)) as {
      message?: string
      delivered?: boolean
    } | null
    return {
      delivered: response.ok && body?.delivered === true,
      message:
        body?.message ??
        (response.ok
          ? "確認メールを送信しました。受信ボックスをご確認ください。"
          : "確認メールの送信に失敗しました。時間をおいて再度お試しください。"),
    }
  } catch {
    return {
      delivered: false,
      message: "確認メールの送信に失敗しました。時間をおいて再度お試しください。",
    }
  }
}

function VerificationSentPanel({
  registeredEmail,
  initialDeliveryError,
  onClearInitialError,
}: {
  registeredEmail: string
  initialDeliveryError: string | null
  onClearInitialError: () => void
}) {
  const [notice, setNotice] = useState<string | null>(initialDeliveryError)
  const [isResending, setIsResending] = useState(false)
  const [hasResent, setHasResent] = useState(() => hasSignupVerificationBeenResent())
  const [emailInput, setEmailInput] = useState(registeredEmail)
  const [lastSentEmail, setLastSentEmail] = useState(registeredEmail)

  useEffect(() => {
    setNotice(initialDeliveryError)
  }, [initialDeliveryError])

  const normalizedInput = emailInput.trim().toLowerCase()
  const emailValid = isValidEmailLike(normalizedInput)
  const emailChanged =
    normalizedInput.length > 0 && normalizedInput !== registeredEmail.trim().toLowerCase()
  const canResend =
    !isResending && emailValid && (!hasResent || normalizedInput !== lastSentEmail.trim().toLowerCase())

  const handleResend = async () => {
    if (!canResend) return
    onClearInitialError()
    setNotice(null)
    setIsResending(true)
    try {
      const result = await requestSignupConfirmationEmail(
        normalizedInput,
        registeredEmail.trim().toLowerCase(),
      )
      if (!result.delivered) {
        setNotice(result.message)
        return
      }
      persistSignupPendingVerificationEmail(normalizedInput)
      setLastSentEmail(normalizedInput)
      if (emailChanged) {
        clearSignupVerificationResent()
      }
      markSignupVerificationResent()
      setHasResent(true)
      setNotice(
        emailChanged
          ? "メールアドレスを更新し、確認メールを送信しました。受信ボックスをご確認ください。"
          : "確認メールを再送しました。受信ボックスをご確認ください。",
      )
    } finally {
      setIsResending(false)
    }
  }

  return (
    <TalkAuthShell>
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-tight text-zinc-500">GritVib</p>
        <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
          {initialDeliveryError && !hasResent ? "確認メールを送信できませんでした" : "メールを送信しました"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-700 md:text-base">
          登録時に入力したメールアドレス宛に確認メールを送りました。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 md:text-base">
          メール内のリンクから登録を完了し、初回ログイン後にニックネームを設定してください。
        </p>
        {notice ? (
          <p
            className={`mt-4 text-sm ${notice.includes("送信しました") ? "text-green-700" : "text-red-600"}`}
            role="alert"
          >
            {notice}
          </p>
        ) : null}
        <p className="mt-6 text-xs leading-relaxed text-zinc-500">
          数分待ってもメールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>
        <div className="mx-auto mt-6 max-w-xs text-left">
          <label htmlFor="verification-resend-email" className="block text-sm font-medium text-black">
            登録したメールアドレス
          </label>
          <input
            id="verification-resend-email"
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isResending}
            className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
          />
          {emailInput.length > 0 && !emailValid ? (
            <p className="mt-1.5 text-xs text-red-600">メールアドレスの形式が正しくありません。</p>
          ) : emailChanged ? (
            <p className="mt-1.5 text-xs text-zinc-500">
              入力を修正して「確認メールを再送する」を押すと、新しいアドレスに送ります。
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={!canResend}
          className="mt-4 inline-flex h-11 w-full max-w-xs items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              送信中…
            </>
          ) : hasResent && normalizedInput === lastSentEmail ? (
            "再送済み"
          ) : (
            "確認メールを再送する"
          )}
        </button>
        <Link
          href="/talk/login"
          className="mt-4 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-black transition-colors hover:bg-zinc-50"
        >
          ログイン画面へ
        </Link>
      </div>
    </TalkAuthShell>
  )
}

type FieldProps = {
  id: string
  label: string
  type: "text" | "email"
  value: string
  onChange: (next: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  required?: boolean
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  required,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-black">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
      />
    </div>
  )
}

function isValidEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function translateSignUpError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("already registered") || normalized.includes("user already")) {
    return "このメールアドレスはすでに登録されています。ログイン画面からお試しください。"
  }
  if (normalized.includes("password")) {
    return "パスワードの要件を満たしていません。8 文字以上で設定してください。"
  }
  if (normalized.includes("rate") || normalized.includes("limit")) {
    return "リクエストが集中しています。少し時間をおいて再度お試しください。"
  }
  return "登録に失敗しました。入力内容をご確認のうえ、再度お試しください。"
}
