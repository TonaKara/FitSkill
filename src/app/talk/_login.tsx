"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { TalkAuthShell } from "@/talk/_auth-shell"
import { TalkBrandHeader } from "@/talk/_brand-header"
import { TalkPasswordField } from "@/talk/_password-field"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readSignupPendingVerificationEmail } from "@/lib/auth-email-flow"
import { resolveGritvibPostAuthPath } from "@/lib/talk/post-auth-redirect"
import { safeClientLogError } from "@/lib/safe-client-log"
import { useTranslations } from "@/lib/i18n/useI18n"

type LoginMode = "login" | "reset"

/**
 * GritVib (人間チャットサービス) のログイン画面。
 */
export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("talk.auth.login")
  const tCommon = useTranslations("talk.common")

  useEffect(() => {
    if (searchParams.get("signup_verified") !== "1") return
    const pending = readSignupPendingVerificationEmail()
    if (pending) setEmail(pending)
    setSuccessMessage(t("signupVerified"))
    router.replace("/talk/login", { scroll: false })
  }, [router, searchParams, t])

  const [mode, setMode] = useState<LoginMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isReset = mode === "reset"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    setErrorMessage(null)
    setSuccessMessage(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!isValidEmailLike(trimmedEmail)) {
      setErrorMessage(t("errorInvalidEmail"))
      return
    }

    if (isReset) {
      setIsSubmitting(true)
      try {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail }),
        })
        if (!response.ok && response.status !== 429) {
          throw new Error("password reset request failed")
        }
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        setSuccessMessage(body?.message ?? t("passwordResetSent"))
      } catch (err) {
        safeClientLogError("[talk/login] password reset failed")
        setErrorMessage(t("errorSendFailed"))
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (password.length === 0) {
      setErrorMessage(t("errorPasswordRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        safeClientLogError("[talk/login] signIn failed")
        setErrorMessage(translateSignInError(error.message, t))
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const path = user
        ? await resolveGritvibPostAuthPath(supabase, user.id)
        : "/talk/chat"
      router.replace(path)
      router.refresh()
    } catch (err) {
      safeClientLogError("[talk/login] unexpected error")
      setErrorMessage(t("errorLoginFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setErrorMessage(null)
    setSuccessMessage(null)
    if (next === "login") {
      setPassword("")
    }
  }

  return (
    <TalkAuthShell>
        <div className="w-full max-w-sm">
          <div className="text-center">
            <TalkBrandHeader />
            <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
              {isReset ? t("resetTitle") : t("title")}
            </h1>
            {isReset ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {t("resetDescription")}
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-black"
              >
                {tCommon("email")}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
                className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
              />
            </div>
            {!isReset ? (
              <TalkPasswordField
                id="login-password"
                label={tCommon("password")}
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                disabled={isSubmitting}
                required
              />
            ) : null}

            {successMessage ? (
              <p className="text-sm text-green-700" role="status">
                {successMessage}
              </p>
            ) : null}

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
                  {isReset ? tCommon("submitting") : t("submittingLogin")}
                </>
              ) : isReset ? (
                t("submitReset")
              ) : (
                t("title")
              )}
            </button>

            {!isReset ? (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                disabled={isSubmitting}
                className="block w-full text-center text-sm text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("forgotPassword")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                disabled={isSubmitting}
                className="block w-full text-center text-sm text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("backToLogin")}
              </button>
            )}

            {!isReset ? (
              <p className="text-center text-sm text-zinc-600">
                {t("noAccount")}{" "}
                <Link
                  href="/talk/register"
                  className="text-black underline-offset-4 hover:underline"
                >
                  {t("getStarted")}
                </Link>
              </p>
            ) : null}
          </form>
        </div>
    </TalkAuthShell>
  )
}

function isValidEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function translateSignInError(
  message: string,
  t: (key: string) => string,
): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("email not confirmed")) {
    return t("errorEmailNotConfirmed")
  }
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid")) {
    return t("errorInvalidCredentials")
  }
  if (normalized.includes("rate") || normalized.includes("limit")) {
    return t("errorRateLimit")
  }
  return t("errorLoginFailed")
}
