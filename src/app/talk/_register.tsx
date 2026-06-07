"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { TalkAuthShell } from "@/talk/_auth-shell"
import { TalkBrandHeader } from "@/talk/_brand-header"
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
import { useTranslations } from "@/lib/i18n/useI18n"

const PASSWORD_MIN_LENGTH = 8

type RegisterPhase = "input" | "submitting" | "verification_sent"

export function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [phase, setPhase] = useState<RegisterPhase>("input")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("talk.auth.register")
  const tLogin = useTranslations("talk.auth.login")
  const tCommon = useTranslations("talk.common")

  const isSubmitting = phase === "submitting"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    setErrorMessage(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!isValidEmailLike(trimmedEmail)) {
      setErrorMessage(t("errorInvalidEmail"))
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(t("errorPasswordTooShort", { min: PASSWORD_MIN_LENGTH }))
      return
    }
    if (password !== passwordConfirm) {
      setErrorMessage(t("errorPasswordMismatch"))
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
        setErrorMessage(translateSignUpError(error.message, t, tLogin))
        setPhase("input")
        return
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      persistSignupPendingVerificationEmail(trimmedEmail)
      clearSignupVerificationResent()

      const mailResult = await requestSignupConfirmationEmail(
        trimmedEmail,
        trimmedEmail,
        t("confirmationSent"),
        t("confirmationFailed"),
      )
      setPhase("verification_sent")
      if (!mailResult.delivered) {
        setErrorMessage(mailResult.message)
      }
    } catch (err) {
      safeClientLogError("[talk/register] unexpected error")
      setErrorMessage(t("errorRegisterFailed"))
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
          <TalkBrandHeader />
          <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-xs text-zinc-600 sm:text-sm">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <Field
            id="register-email"
            label={tCommon("email")}
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
            label={tCommon("password")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={t("passwordMinPlaceholder", { min: PASSWORD_MIN_LENGTH })}
            disabled={isSubmitting}
            required
          />
          <TalkPasswordField
            id="register-password-confirm"
            label={tCommon("passwordConfirm")}
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
                {tCommon("submitting")}
              </>
            ) : (
              t("createAccount")
            )}
          </button>
          <p className="text-center text-sm text-zinc-600">
            {t("hasAccount")}{" "}
            <Link
              href="/talk/login"
              className="text-black underline-offset-4 hover:underline"
            >
              {t("login")}
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
  successFallback: string,
  failureFallback: string,
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
      message: body?.message ?? (response.ok ? successFallback : failureFallback),
    }
  } catch {
    return {
      delivered: false,
      message: failureFallback,
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
  const t = useTranslations("talk.auth.register")
  const tLogin = useTranslations("talk.auth.login")
  const tCommon = useTranslations("talk.common")

  const [notice, setNotice] = useState<string | null>(initialDeliveryError)
  const [noticeKind, setNoticeKind] = useState<"success" | "error" | null>(
    initialDeliveryError ? "error" : null,
  )
  const [isResending, setIsResending] = useState(false)
  const [hasResent, setHasResent] = useState(() => hasSignupVerificationBeenResent())
  const [emailInput, setEmailInput] = useState(registeredEmail)
  const [lastSentEmail, setLastSentEmail] = useState(registeredEmail)

  useEffect(() => {
    setNotice(initialDeliveryError)
    setNoticeKind(initialDeliveryError ? "error" : null)
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
    setNoticeKind(null)
    setIsResending(true)
    try {
      const result = await requestSignupConfirmationEmail(
        normalizedInput,
        registeredEmail.trim().toLowerCase(),
        t("confirmationSent"),
        t("confirmationFailed"),
      )
      if (!result.delivered) {
        setNotice(result.message)
        setNoticeKind("error")
        return
      }
      persistSignupPendingVerificationEmail(normalizedInput)
      setLastSentEmail(normalizedInput)
      if (emailChanged) {
        clearSignupVerificationResent()
      }
      markSignupVerificationResent()
      setHasResent(true)
      setNotice(emailChanged ? t("verificationEmailUpdated") : t("verificationResent"))
      setNoticeKind("success")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <TalkAuthShell>
      <div className="w-full max-w-md text-center">
        <TalkBrandHeader />
        <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
          {initialDeliveryError && !hasResent
            ? t("verificationTitleFailed")
            : t("verificationTitleSent")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-700 md:text-base">
          {t("verificationBody1")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 md:text-base">
          {t("verificationBody2")}
        </p>
        {notice ? (
          <p
            className={`mt-4 text-sm ${noticeKind === "success" ? "text-green-700" : "text-red-600"}`}
            role="alert"
          >
            {notice}
          </p>
        ) : null}
        <p className="mt-6 text-xs leading-relaxed text-zinc-500">
          {t("verificationSpamHint")}
        </p>
        <div className="mx-auto mt-6 max-w-xs text-left">
          <label htmlFor="verification-resend-email" className="block text-sm font-medium text-black">
            {t("verificationEmailLabel")}
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
            <p className="mt-1.5 text-xs text-red-600">{t("errorInvalidEmail")}</p>
          ) : emailChanged ? (
            <p className="mt-1.5 text-xs text-zinc-500">{t("verificationEmailChangedHint")}</p>
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
              {tCommon("submitting")}
            </>
          ) : hasResent && normalizedInput === lastSentEmail ? (
            t("verificationResentDone")
          ) : (
            t("verificationResend")
          )}
        </button>
        <Link
          href="/talk/login"
          className="mt-4 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-medium text-black transition-colors hover:bg-zinc-50"
        >
          {t("goToLogin")}
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

function translateSignUpError(
  message: string,
  t: (key: string) => string,
  tLogin: (key: string) => string,
): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("already registered") || normalized.includes("user already")) {
    return t("errorAlreadyRegistered")
  }
  if (normalized.includes("password")) {
    return t("errorPasswordWeak")
  }
  if (normalized.includes("rate") || normalized.includes("limit")) {
    return tLogin("errorRateLimit")
  }
  return t("errorRegisterGeneric")
}
