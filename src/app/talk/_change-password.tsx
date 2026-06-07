"use client"

import { FormEvent, useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { TalkAuthShell } from "@/talk/_auth-shell"
import { TalkPasswordField } from "@/talk/_password-field"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { safeClientLogError } from "@/lib/safe-client-log"
import {
  AUTH_PASSWORD_MIN_LENGTH,
  getPasswordRuleState,
} from "@/lib/auth/password-policy"
import { useTranslations } from "@/lib/i18n/useI18n"

type ChangePasswordPageProps = {
  isAdmin: boolean
  returnPath: string
}

export function ChangePasswordPage({ isAdmin, returnPath }: ChangePasswordPageProps) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("talk.changePassword")
  const tCommon = useTranslations("talk.common")

  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signingOutForLogin, setSigningOutForLogin] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleLoginForPasswordReset = useCallback(async () => {
    if (signingOutForLogin || isSubmitting) return
    setSigningOutForLogin(true)
    try {
      await supabase.auth.signOut()
    } catch {
      safeClientLogError("[talk/change-password] signOut before login failed")
    } finally {
      router.replace("/talk/login")
      router.refresh()
    }
  }, [isSubmitting, router, signingOutForLogin, supabase])

  const passwordRuleState = useMemo(() => getPasswordRuleState(password), [password])
  const isConfirmMatched = passwordConfirm.length > 0 && password === passwordConfirm

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    setErrorMessage(null)
    setSuccessMessage(null)

    if (currentPassword.length === 0) {
      setErrorMessage(t("errorCurrentRequired"))
      return
    }
    if (!passwordRuleState.isValid) {
      setErrorMessage(t("errorPolicy"))
      return
    }
    if (!isConfirmMatched) {
      setErrorMessage(t("errorMismatch"))
      return
    }

    setIsSubmitting(true)
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      const email = user?.email?.trim().toLowerCase() ?? ""
      if (userError || !email) {
        setErrorMessage(t("errorSessionExpired"))
        return
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauthError) {
        safeClientLogError("[talk/change-password] reauth failed")
        setErrorMessage(translatePasswordUpdateError(reauthError.message, t))
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        safeClientLogError("[talk/change-password] update failed")
        setErrorMessage(translatePasswordUpdateError(updateError.message, t))
        return
      }

      setSuccessMessage(t("success"))
      setCurrentPassword("")
      setPassword("")
      setPasswordConfirm("")
      window.setTimeout(() => {
        router.replace(returnPath)
        router.refresh()
      }, 1200)
    } catch {
      safeClientLogError("[talk/change-password] unexpected error")
      setErrorMessage(t("errorFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <TalkAuthShell>
      <div className="w-full max-w-md">
        <Link
          href={returnPath}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {tCommon("back")}
        </Link>

        <h1 className="text-xl font-semibold tracking-tight text-black">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("description")}</p>
        {isAdmin ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {t("adminNote")}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <TalkPasswordField
            id="current-password"
            label={t("currentPassword")}
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={isSubmitting}
            required
          />

          <TalkPasswordField
            id="new-password"
            label={t("newPassword")}
            autoComplete="new-password"
            placeholder={t("newPasswordPlaceholder", { min: AUTH_PASSWORD_MIN_LENGTH })}
            value={password}
            onChange={setPassword}
            disabled={isSubmitting}
            required
          />
          <div className="space-y-1 text-xs text-zinc-500">
            {!passwordRuleState.hasMinLength && password.length > 0 ? (
              <p>{t("ruleMinLength")}</p>
            ) : null}
            {!passwordRuleState.hasUppercase && password.length > 0 ? (
              <p>{t("ruleUppercase")}</p>
            ) : null}
            {!passwordRuleState.hasLowercase && password.length > 0 ? (
              <p>{t("ruleLowercase")}</p>
            ) : null}
            {!passwordRuleState.hasNumber && password.length > 0 ? (
              <p>{t("ruleNumber")}</p>
            ) : null}
          </div>

          <TalkPasswordField
            id="confirm-password"
            label={t("newPasswordConfirm")}
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            disabled={isSubmitting}
            required
          />
          {passwordConfirm.length > 0 && !isConfirmMatched ? (
            <p className="text-xs text-red-600">{t("errorMismatch")}</p>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-green-700" role="status">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 w-full items-center justify-center rounded-md bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          {t("forgotCurrentPrefix")}{" "}
          <button
            type="button"
            onClick={() => void handleLoginForPasswordReset()}
            disabled={isSubmitting || signingOutForLogin}
            className="text-black underline underline-offset-2 transition-colors hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOutForLogin ? t("signingOut") : t("forgotCurrentLink")}
          </button>
          {t("forgotCurrentSuffix")}
        </p>
      </div>
    </TalkAuthShell>
  )
}

function translatePasswordUpdateError(
  message: string,
  t: (key: string) => string,
): string {
  const lower = message.toLowerCase()
  if (lower.includes("same") && lower.includes("password")) {
    return t("errorSamePassword")
  }
  if (lower.includes("weak") || lower.includes("at least")) {
    return t("errorWeakPassword")
  }
  if (lower.includes("invalid login credentials")) {
    return t("errorWrongCurrent")
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return t("errorRateLimit")
  }
  if (lower.includes("session") || lower.includes("not authenticated")) {
    return t("errorSessionExpired")
  }
  if (
    lower.includes("invalid") &&
    (lower.includes("credential") || lower.includes("login"))
  ) {
    return t("errorWrongCurrent")
  }
  return t("errorFailed")
}
