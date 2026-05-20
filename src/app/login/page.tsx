"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NotificationToast } from "@/components/ui/notification-toast"
import {
  buildSignupConfirmationRedirectUrl,
  clearSessionPostEmailConfirmLogin,
  clearSignupPendingVerificationEmail,
  clearSignupVerificationResent,
  hasSignupVerificationBeenResent,
  isPostEmailConfirmLoginHelpDone,
  isSessionPostEmailConfirmLogin,
  markPostEmailConfirmLoginHelpDone,
  markSessionPostEmailConfirmLogin,
  markSignupVerificationResent,
  persistSignupPendingVerificationEmail,
  readSignupPendingVerificationEmail,
} from "@/lib/auth-email-flow"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/useI18n"

type AuthMode = "login" | "signup" | "reset"

const PASSWORD_MIN_LENGTH = 8

/** ローカル日付を input[type=date] 用 YYYY-MM-DD にする */
function formatLocalIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getPasswordRuleState(password: string) {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber,
  }
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("login")
  const tToasts = useTranslations("authToasts")

  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [confirmEmail, setConfirmEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [birthday, setBirthday] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupVerificationEmail, setSignupVerificationEmail] = useState<string | null>(null)
  const [verificationPanelNotice, setVerificationPanelNotice] = useState<AppNotice | null>(null)
  const [isResendingVerificationEmail, setIsResendingVerificationEmail] = useState(false)
  const [isSignupVerificationRecovery, setIsSignupVerificationRecovery] = useState(false)
  const [hasSignupVerificationResent, setHasSignupVerificationResent] = useState(false)
  const [hidePostEmailLoginHelp, setHidePostEmailLoginHelp] = useState(false)
  const peekToastShownRef = useRef(false)
  const authCallbackBridgeSentRef = useRef(false)

  const isSignup = mode === "signup"
  const isReset = mode === "reset"
  const isAwaitingSignupVerification = signupVerificationEmail !== null
  const title = useMemo(() => {
    if (isAwaitingSignupVerification) {
      return isSignupVerificationRecovery ? t("titleVerifyRecovery") : t("titleVerify")
    }
    if (isSignup) {
      return t("titleSignup")
    }
    if (isReset) {
      return t("titleReset")
    }
    return t("titleLogin")
  }, [isAwaitingSignupVerification, isReset, isSignup, isSignupVerificationRecovery, t])
  const passwordRuleState = useMemo(() => getPasswordRuleState(password), [password])
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedConfirmEmail = confirmEmail.trim().toLowerCase()
  const isEmailMatched =
    !isSignup || (normalizedConfirmEmail.length > 0 && normalizedConfirmEmail === normalizedEmail)
  const isConfirmMatched = !isSignup || (confirmPassword.length > 0 && password === confirmPassword)
  const todayIsoDate = formatLocalIsoDate(new Date())
  const isSignupDisabled =
    isSignup &&
    (!passwordRuleState.isValid || !isEmailMatched || !isConfirmMatched || !birthday.trim())
  const normalizedResendEmail = email.trim().toLowerCase()
  const registeredSignupEmail = signupVerificationEmail?.trim().toLowerCase() ?? ""
  const resendEmailChangedFromRegistered =
    isAwaitingSignupVerification &&
    registeredSignupEmail.length > 0 &&
    normalizedResendEmail !== registeredSignupEmail
  const canShowPostEmailLoginHelp =
    !isSignup &&
    !isReset &&
    !isAwaitingSignupVerification &&
    isSessionPostEmailConfirmLogin() &&
    !isPostEmailConfirmLoginHelpDone() &&
    !hidePostEmailLoginHelp
  const canResendSignupVerification =
    isAwaitingSignupVerification &&
    !hasSignupVerificationResent &&
    isLikelyEmail(normalizedResendEmail) &&
    !resendEmailChangedFromRegistered

  /**
   * Supabase の Site URL が `/login` 等になっていると、確認リンクが `/login?code=...` や
   * `/login?token_hash=...&type=signup` に着地し `/auth/callback` を通らない。
   * その場合はクエリを保ったまま `/auth/callback` へ送る（`next` 欠落の signup/email は補完）。
   */
  useEffect(() => {
    const modeParam = searchParams.get("mode")?.trim().toLowerCase()
    if (modeParam === "signup") {
      setMode("signup")
      return
    }
    if (modeParam === "reset") {
      setMode("reset")
    }
  }, [searchParams])

  useEffect(() => {
    if (authCallbackBridgeSentRef.current) {
      return
    }
    const code = searchParams.get("code")?.trim()
    const tokenHash = searchParams.get("token_hash")?.trim()
    const type = searchParams.get("type")?.trim()
    if (!code && !(tokenHash && type)) {
      return
    }
    authCallbackBridgeSentRef.current = true
    const params = new URLSearchParams(searchParams.toString())
    if (!params.get("next") && (type === "signup" || type === "email")) {
      params.set("next", "/profile-setup")
    }
    router.replace(`/auth/callback?${params.toString()}`)
  }, [router, searchParams])

  useEffect(() => {
    if (searchParams.get("signup_verified") !== "1") {
      return
    }

    const pending = readSignupPendingVerificationEmail()
    setEmail(pending ?? "")
    setSignupVerificationEmail(null)
    setIsSignupVerificationRecovery(false)
    setVerificationPanelNotice(null)
    setMode("login")
    markSessionPostEmailConfirmLogin()
    peekToastShownRef.current = true
    setNotice(toSuccessNotice(tToasts("registeredCheckEmail")))
    setHasSignupVerificationResent(hasSignupVerificationBeenResent())
    router.replace("/login?signup_verified=1", { scroll: false })
  }, [searchParams, router])

  useEffect(() => {
    if (searchParams.get("error") !== "auth_callback") {
      return
    }

    const pendingEmail = readSignupPendingVerificationEmail()
    setEmail(pendingEmail ?? "")
    setSignupVerificationEmail(pendingEmail ?? "")
    setIsSignupVerificationRecovery(true)
    setMode("login")
    markSessionPostEmailConfirmLogin()
    peekToastShownRef.current = true
    setVerificationPanelNotice(null)
    setNotice(toSuccessNotice(tToasts("registeredCheckEmail")))
    setHasSignupVerificationResent(hasSignupVerificationBeenResent())
    router.replace("/login?signup_verified=1", { scroll: false })
  }, [searchParams, router])

  useEffect(() => {
    if (mode !== "login" || isReset || isAwaitingSignupVerification) {
      return
    }
    if (!isLikelyEmail(normalizedEmail)) {
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/auth/peek-sign-in-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail }),
          })
          const json = (await response.json()) as {
            found?: boolean
            pendingFirstPasswordLogin?: boolean
          }
          if (json.pendingFirstPasswordLogin) {
            markSessionPostEmailConfirmLogin()
            if (!peekToastShownRef.current) {
              peekToastShownRef.current = true
              setNotice(
                toSuccessNotice(
                  tToasts("registeredCheckEmail"),
                ),
              )
            }
            return
          }
        } catch {
          /* オフライン等ではセッション印を維持 */
        }
      })()
    }, 450)

    return () => window.clearTimeout(timer)
  }, [normalizedEmail, mode, isReset, isAwaitingSignupVerification])

  useEffect(() => {
    if (!isAwaitingSignupVerification) {
      return
    }
    setHasSignupVerificationResent(hasSignupVerificationBeenResent())
  }, [isAwaitingSignupVerification])

  const resetSignupFormFields = () => {
    setConfirmEmail("")
    setConfirmPassword("")
    setPassword("")
    setFullName("")
    setBirthday("")
    setDisplayName("")
  }

  const returnToLoginFromSignupVerification = () => {
    if (isSignupVerificationRecovery) {
      markSessionPostEmailConfirmLogin()
      peekToastShownRef.current = true
    }
    setSignupVerificationEmail(null)
    setVerificationPanelNotice(null)
    setIsSignupVerificationRecovery(false)
    clearSignupPendingVerificationEmail()
    clearSignupVerificationResent()
    setHasSignupVerificationResent(false)
    setMode("login")
    setNotice(null)
    resetSignupFormFields()
    setEmail("")
  }

  const returnToSignupWithEditedEmail = () => {
    const nextEmail = email.trim()
    setSignupVerificationEmail(null)
    setVerificationPanelNotice(null)
    setIsSignupVerificationRecovery(false)
    clearSignupPendingVerificationEmail()
    clearSignupVerificationResent()
    setHasSignupVerificationResent(false)
    setMode("signup")
    setNotice(null)
    setEmail(nextEmail)
    setConfirmEmail(nextEmail)
    resetSignupFormFields()
  }

  const handleResendSignupVerification = async () => {
    if (!isAwaitingSignupVerification || isResendingVerificationEmail || hasSignupVerificationResent) {
      return
    }

    if (!isLikelyEmail(normalizedResendEmail)) {
      setVerificationPanelNotice({
        variant: "error",
        message: tToasts("resendInvalidEmail"),
      })
      return
    }

    if (resendEmailChangedFromRegistered) {
      setVerificationPanelNotice({
        variant: "error",
        message:
          tToasts("resendMismatch"),
      })
      return
    }

    setVerificationPanelNotice(null)
    setIsResendingVerificationEmail(true)
    try {
      const response = await fetch("/api/auth/resend-signup-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedResendEmail }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string; delivered?: boolean } | null
      if (!response.ok || body?.delivered !== true) {
        clearSignupVerificationResent()
        setHasSignupVerificationResent(false)
        setVerificationPanelNotice({
          variant: "error",
          message: body?.message ?? tToasts("resendFailedFallback"),
        })
        return
      }

      const successMessage = body?.message ?? tToasts("resendSuccessFallback")
      const successNotice = toSuccessNotice(successMessage)
      markSignupVerificationResent()
      setHasSignupVerificationResent(true)
      setVerificationPanelNotice(successNotice)
      setNotice(successNotice)
    } catch {
      clearSignupVerificationResent()
      setHasSignupVerificationResent(false)
      setVerificationPanelNotice({
        variant: "error",
        message: tToasts("resendFailedFallback"),
      })
    } finally {
      setIsResendingVerificationEmail(false)
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const loadSession = async () => {
      const { data } = await supabase.auth.getUser()

      if (!data.user?.id) {
        setIsAdmin(false)
        return
      }

      const adminFlag = await getIsAdminFromProfile(supabase, data.user.id)
      setIsAdmin(adminFlag)
    }

    void loadSession()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setIsSubmitting(true)

    const supabase = getSupabaseBrowserClient()
    const trimmedDisplayName = displayName.trim()
    const trimmedFullName = fullName.trim()

    try {
      if (!normalizedEmail) {
        setNotice({ variant: "error", message: tToasts("emailRequired") })
        return
      }

      if (!isReset && !password) {
        setNotice({ variant: "error", message: tToasts("emailAndPasswordRequired") })
        return
      }

      if (isReset) {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        if (!response.ok && response.status !== 429) {
          throw new Error(tToasts("passwordResetMailFailed"))
        }

        setNotice(
          toSuccessNotice(tToasts("passwordResetMailSent")),
        )
        return
      }

      if (isSignup && !trimmedDisplayName) {
        setNotice({ variant: "error", message: tToasts("displayNameRequired") })
        return
      }

      if (isSignup && !isEmailMatched) {
        setNotice({
          variant: "error",
          message: tToasts("emailConfirmMismatch"),
        })
        return
      }

      if (isSignup && !passwordRuleState.isValid) {
        setNotice({
          variant: "error",
          message: tToasts("passwordPolicy"),
        })
        return
      }

      if (isSignup && !isConfirmMatched) {
        setNotice({
          variant: "error",
          message: tToasts("passwordConfirmMismatch"),
        })
        return
      }

      const todayStr = formatLocalIsoDate(new Date())
      if (isSignup) {
        const birthdayTrimmed = birthday.trim()
        if (!birthdayTrimmed) {
          setNotice({ variant: "error", message: tToasts("birthdayRequired") })
          return
        }
        if (birthdayTrimmed > todayStr) {
          setNotice({ variant: "error", message: tToasts("birthdayFuture") })
          return
        }
      }

      if (!isSignup) {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (error) {
          throw error
        }

        const redirectToProfileSetup = isSessionPostEmailConfirmLogin()
        if (redirectToProfileSetup) {
          clearSessionPostEmailConfirmLogin()
        }

        setNotice(toSuccessNotice(tToasts("loginSuccess")))
        router.push(redirectToProfileSetup ? "/profile-setup" : "/")
        router.refresh()
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: buildSignupConfirmationRedirectUrl(),
          data: {
            display_name: trimmedDisplayName,
            full_name: trimmedFullName || null,
            birthday: birthday.trim(),
          },
        },
      })

      if (signUpError) {
        throw signUpError
      }

      const signUpUser = signUpData.user
      if (!signUpUser?.id) {
        throw new Error(tToasts("userCreateFailed"))
      }

      const identities = signUpUser.identities ?? []
      if (identities.length === 0) {
        setNotice({
          variant: "error",
          message:
            tToasts("emailMaybeRegistered"),
        })
        return
      }

      if (!signUpData.session) {
        await supabase.auth.signOut()
        setNotice(null)
        setVerificationPanelNotice(null)
        setSignupVerificationEmail(normalizedEmail)
        persistSignupPendingVerificationEmail(normalizedEmail)
        clearSignupVerificationResent()
        setHasSignupVerificationResent(false)
        setIsSignupVerificationRecovery(false)
        resetSignupFormFields()
        return
      }

      try {
        await fetch("/api/notifications/new-user-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: signUpUser.id,
            email: normalizedEmail,
            displayName: trimmedDisplayName,
          }),
          keepalive: true,
        })
      } catch {
        // Discord 通知失敗でサインアップ自体は失敗扱いにしない
      }

      setNotice(toSuccessNotice(tToasts("accountCreated")))
      router.push("/profile-setup")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, isAdmin))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell>
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-lg dark:border-red-500/40 dark:bg-zinc-950/95 dark:shadow-[0_0_60px_rgba(230,74,25,0.25)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e64a19]">
              <BrandMarkSvg className="h-5 w-5" />
            </div>
            <span>
              <span className="text-primary-readable">Grit</span>
              <span className="text-foreground">Vib</span>
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-wide text-foreground">{title}</CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">
              {isAwaitingSignupVerification
                ? isSignupVerificationRecovery
                  ? t("descVerifyRecovery")
                  : t("descVerify")
                : isSignup
                  ? t("descSignup")
                  : isReset
                    ? t("descReset")
                    : t("descLogin")}
            </CardDescription>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-red-500 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Link href="/">{t("backToHome")}</Link>
          </Button>

          {!isAwaitingSignupVerification ? (
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setNotice(null)
                setSignupVerificationEmail(null)
                setConfirmEmail("")
                setConfirmPassword("")
                setPassword("")
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                mode === "login"
                  ? "bg-red-600 text-white shadow-[0_0_22px_rgba(230,74,25,0.45)]"
                  : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {t("tabLogin")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup")
                setNotice(null)
                setSignupVerificationEmail(null)
                setConfirmEmail("")
                setConfirmPassword("")
                setPassword("")
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                mode === "signup"
                  ? "bg-red-600 text-white shadow-[0_0_22px_rgba(230,74,25,0.45)]"
                  : "text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {t("tabSignup")}
            </button>
          </div>
          ) : null}
        </CardHeader>

        <CardContent>
          {isAwaitingSignupVerification ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm leading-relaxed text-emerald-950 dark:text-emerald-100">
                <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                  {isSignupVerificationRecovery ? t("verifyDoneLikely") : t("verifySent")}
                </p>
                <p className="mt-3 text-emerald-900/85 dark:text-emerald-100/90">
                  {isSignupVerificationRecovery ? t("verifyRecoveryBody") : t("verifySentBody")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="signup_verification_email">
                  {t("verifyEmailLabel")}
                </label>
                <Input
                  id="signup_verification_email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setVerificationPanelNotice(null)
                  }}
                  autoComplete="email"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("verifyEmailHint")}
                </p>
                {email.trim().length > 0 && !isLikelyEmail(normalizedResendEmail) ? (
                  <p className="text-xs text-red-400">{t("verifyEmailFormatError")}</p>
                ) : null}
                {resendEmailChangedFromRegistered ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {t("verifyEmailChanged", { email: registeredSignupEmail })}
                  </p>
                ) : null}
              </div>

              {verificationPanelNotice ? (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
                    verificationPanelNotice.variant === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
                  )}
                >
                  {verificationPanelNotice.message}
                </div>
              ) : null}

              {isSignupVerificationRecovery ? (
                <div className="rounded-lg border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{t("verifyHelpRecoveryTitle")}</p>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {t("verifyHelpRecoveryIntro")}
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>{t("verifyHelpItemCredentials")}</li>
                    <li>{t("verifyHelpItemSpam")}</li>
                    {hasSignupVerificationResent ? (
                      <>
                        <li>{t("verifyHelpItemResentOnce")}</li>
                        <li>{t("verifyHelpItemReRegisterRecovery")}</li>
                      </>
                    ) : (
                      <>
                        <li>{t("verifyHelpItemResendWait")}</li>
                        <li>{t("verifyHelpItemReRegisterEditRecovery")}</li>
                      </>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted px-4 py-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{t("verifyHelpInitialTitle")}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>{t("verifyHelpItemSpam")}</li>
                    {hasSignupVerificationResent ? (
                      <>
                        <li>{t("verifyHelpItemResentOnce")}</li>
                        <li>{t("verifyHelpItemReRegister")}</li>
                      </>
                    ) : (
                      <>
                        <li>{t("verifyHelpItemResendWaitInitial")}</li>
                        <li>{t("verifyHelpItemReRegisterEdit")}</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              {hasSignupVerificationResent ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-950 dark:text-amber-100">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">{t("verifyAlreadyResentTitle")}</p>
                  <p className="mt-3 text-amber-900/90 dark:text-amber-100/90">
                    {t("verifyAlreadyResentBody")}
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                disabled={isResendingVerificationEmail || !canResendSignupVerification}
                className="h-11 w-full bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                onClick={() => void handleResendSignupVerification()}
              >
                {isResendingVerificationEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("verifyResending")}
                  </>
                ) : hasSignupVerificationResent ? (
                  t("verifyAlreadyResent")
                ) : (
                  t("verifyResend")
                )}
              </Button>

              {resendEmailChangedFromRegistered ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-amber-500/50 bg-muted text-amber-900 hover:bg-muted/80 dark:text-amber-100"
                  onClick={returnToSignupWithEditedEmail}
                >
                  {t("verifyReRegisterButton")}
                </Button>
              ) : null}

              <Button
                type="button"
                asChild
                variant={hasSignupVerificationResent ? "default" : "outline"}
                className={
                  hasSignupVerificationResent
                    ? "h-11 w-full bg-red-600 text-white hover:bg-red-500"
                    : "h-11 w-full border-border bg-muted text-foreground hover:bg-muted/80"
                }
              >
                <Link href="/contact">{t("verifyContactButton")}</Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-border bg-muted text-foreground hover:bg-muted/80"
                onClick={returnToLoginFromSignupVerification}
              >
                {t("verifyBackToLogin")}
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="full_name">
                  {t("fullName")}
                </label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  autoComplete="name"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("fullNameHelp")}
                </p>
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="birthday">
                  {t("birthday")}
                </label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  max={todayIsoDate}
                  onChange={(event) => {
                    const next = event.target.value
                    if (next && next > todayIsoDate) {
                      return
                    }
                    setBirthday(next)
                  }}
                  autoComplete="bday"
                  className="border-input bg-background text-foreground dark:[color-scheme:dark] focus-visible:ring-red-500"
                />
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="display_name">
                  {t("displayName")}
                </label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t("displayNamePlaceholder")}
                  autoComplete="nickname"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                {t("email")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </div>

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="confirm_email">
                  {t("emailConfirm")}
                </label>
                <Input
                  id="confirm_email"
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder={t("emailConfirmPlaceholder")}
                  autoComplete="email"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                {confirmEmail.length > 0 && !isEmailMatched && (
                  <p className="text-xs text-red-400">{t("emailMismatch")}</p>
                )}
              </div>
            )}

            {!isReset && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  {t("password")}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? t("passwordPlaceholderSignup") : t("passwordPlaceholderLogin")}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={showPassword ? t("passwordToggleHide") : t("passwordToggleShow")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignup && (
                  <div className="space-y-1 text-xs">
                    {!passwordRuleState.hasMinLength && <p className="text-red-400">{t("passwordRuleMin")}</p>}
                    {!passwordRuleState.hasUppercase && <p className="text-red-400">{t("passwordRuleUpper")}</p>}
                    {!passwordRuleState.hasLowercase && <p className="text-red-400">{t("passwordRuleLower")}</p>}
                    {!passwordRuleState.hasNumber && <p className="text-red-400">{t("passwordRuleNumber")}</p>}
                  </div>
                )}
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="confirm_password">
                  {t("passwordConfirm")}
                </label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("passwordConfirmPlaceholder")}
                    autoComplete="new-password"
                    className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={showConfirmPassword ? t("passwordConfirmToggleHide") : t("passwordConfirmToggleShow")}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !isConfirmMatched && (
                  <p className="text-xs text-red-400">{t("passwordMismatch")}</p>
                )}
              </div>
            )}

            {isSignup && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p>
                  {t("displayNameNote")}
                </p>
              </div>
            )}

            {!isSignup && !isReset && (
              <div className="space-y-3">
                {canShowPostEmailLoginHelp ? (
                  <div className="rounded-lg border border-border bg-muted px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">{t("loginHelpTitle")}</p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4">
                      <li>{t("loginHelpItemCredentials")}</li>
                      <li>{t("loginHelpItemForgot")}</li>
                      <li>
                        {t("loginHelpItemContactPrefix")}
                        <Link href="/contact" className="text-red-400 underline hover:text-red-300">
                          {t("loginHelpItemContactLink")}
                        </Link>
                        {t("loginHelpItemContactSuffix")}
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        markPostEmailConfirmLoginHelpDone()
                        setHidePostEmailLoginHelp(true)
                      }}
                      className="mt-3 w-full text-left text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {t("loginHelpHide")}
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset")
                    setNotice(null)
                    setPassword("")
                  }}
                  className="w-full text-right text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-red-300 hover:underline"
                >
                  {t("forgotPassword")}
                </button>
              </div>
            )}

            {isReset && (
              <button
                type="button"
                onClick={() => {
                  setMode("login")
                  setNotice(null)
                }}
                className="w-full text-right text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-red-300 hover:underline"
              >
                {t("returnToLogin")}
              </button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || isSignupDisabled}
              className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : isSignup ? (
                t("submitSignup")
              ) : isReset ? (
                t("submitReset")
              ) : (
                t("submitLogin")
              )}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}

