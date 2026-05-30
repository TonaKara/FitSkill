"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { buildAuthCallbackRedirectUrl } from "@/lib/auth-email-flow"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import { useFromHereAuth } from "@/fromhere/_auth-context"

const PASSWORD_MIN_LENGTH = 8
const FROMHERE_ONBOARDING_PATH = "/fromhere/onboarding"

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

/** FromHere 専用のサインアップページ。
 *
 * - `supabase.auth.signUp` でメール+パスワード登録し、メール確認後は
 *   `/auth/callback?next=/fromhere/onboarding` 経由で onboarding に着地する。
 * - メール確認待ちパネルを内蔵し、戻る/別メールで再登録の動線を提供する。
 */
export default function FromHereSignUpPage() {
  const router = useRouter()
  const t = useTranslations("fromhere.auth")
  const tToast = useTranslations("fromhere.auth.toasts")

  const { user, profile, loading: authLoading } = useFromHereAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
  const redirectedRef = useRef(false)

  /** 既ログイン時の自動リダイレクト */
  useEffect(() => {
    if (authLoading || redirectedRef.current) {
      return
    }
    if (!user) {
      return
    }
    redirectedRef.current = true
    router.replace(profile ? "/fromhere" : FROMHERE_ONBOARDING_PATH)
  }, [authLoading, user, profile, router])

  const passwordRuleState = useMemo(() => getPasswordRuleState(password), [password])
  const isAwaitingVerification = pendingVerificationEmail !== null
  /** パスワードが空でなく、確認用と一致しているか */
  const isPasswordConfirmMatched =
    confirmPassword.length > 0 && confirmPassword === password

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setIsSubmitting(true)

    const supabase = getSupabaseBrowserClient()
    const normalizedEmail = email.trim().toLowerCase()

    try {
      if (!normalizedEmail) {
        setNotice({ variant: "error", message: tToast("emailRequired") })
        return
      }
      if (!password) {
        setNotice({ variant: "error", message: tToast("passwordRequired") })
        return
      }
      if (!passwordRuleState.isValid) {
        setNotice({ variant: "error", message: tToast("passwordPolicy") })
        return
      }
      if (!isPasswordConfirmMatched) {
        setNotice({ variant: "error", message: tToast("passwordConfirmMismatch") })
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: buildAuthCallbackRedirectUrl(FROMHERE_ONBOARDING_PATH),
        },
      })

      if (signUpError) {
        setNotice({ variant: "error", message: tToast("signupFailed") })
        return
      }

      const signedUpUser = signUpData.user
      if (!signedUpUser?.id) {
        setNotice({ variant: "error", message: tToast("signupFailed") })
        return
      }

      const identities = signedUpUser.identities ?? []
      if (identities.length === 0) {
        setNotice({ variant: "error", message: tToast("emailMaybeRegistered") })
        return
      }

      if (!signUpData.session) {
        await supabase.auth.signOut()
        setPendingVerificationEmail(normalizedEmail)
        setPassword("")
        setConfirmPassword("")
        setNotice(toSuccessNotice(tToast("signupSuccess")))
        return
      }

      // メール確認が無効化されているケースのみセッションが即時付与される。
      // この場合は onboarding 側で newvibes_profiles を作成しに行く。
      setNotice(toSuccessNotice(tToast("signupSuccess")))
      redirectedRef.current = true
      router.replace(FROMHERE_ONBOARDING_PATH)
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAwaitingVerification) {
    return (
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 md:py-16">
        {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <MailCheck className="h-6 w-6" aria-hidden />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">{t("verifySentTitle")}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {t("verifySentBody", { email: pendingVerificationEmail ?? "" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              asChild
              variant="outline"
              className="h-11 w-full border-border bg-muted text-foreground hover:bg-muted/80"
            >
              <Link href="/fromhere/signin">{t("verifyBackToSignin")}</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setPendingVerificationEmail(null)
                setEmail("")
                setNotice(null)
              }}
            >
              {t("noAccountAction")}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <Link href="/fromhere" className="underline-offset-4 hover:underline">
            ← {t("backToFromHere")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 md:py-16">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <Card className="border-border bg-card shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-bold text-foreground">{t("signupTitle")}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{t("signupSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_signup_email">
                {t("email")}
              </label>
              <Input
                id="fromhere_signup_email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                className="border-input bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_signup_password">
                {t("password")}
              </label>
              <div className="relative">
                <Input
                  id="fromhere_signup_password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("passwordPlaceholderSignup")}
                  autoComplete="new-password"
                  className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t("passwordToggleHide") : t("passwordToggleShow")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <ul className="space-y-1 text-xs">
                <li className={passwordRuleState.hasMinLength ? "text-emerald-500" : "text-muted-foreground"}>
                  {t("passwordRuleMin")}
                </li>
                <li className={passwordRuleState.hasUppercase ? "text-emerald-500" : "text-muted-foreground"}>
                  {t("passwordRuleUpper")}
                </li>
                <li className={passwordRuleState.hasLowercase ? "text-emerald-500" : "text-muted-foreground"}>
                  {t("passwordRuleLower")}
                </li>
                <li className={passwordRuleState.hasNumber ? "text-emerald-500" : "text-muted-foreground"}>
                  {t("passwordRuleNumber")}
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="fromhere_signup_password_confirm"
              >
                {t("passwordConfirm")}
              </label>
              <div className="relative">
                <Input
                  id="fromhere_signup_password_confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("passwordConfirmPlaceholder")}
                  autoComplete="new-password"
                  className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? t("passwordConfirmToggleHide")
                      : t("passwordConfirmToggleShow")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !isPasswordConfirmMatched ? (
                <p className="text-xs text-red-500">{tToast("passwordConfirmMismatch")}</p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("termsNote", { terms: t("termsLink"), privacy: t("privacyLink") })}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Link href="/legal/terms" className="underline-offset-4 hover:text-foreground hover:underline">
                {t("termsLink")}
              </Link>
              <Link href="/legal/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
                {t("privacyLink")}
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !passwordRuleState.isValid || !isPasswordConfirmMatched}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submitSignup")
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("hasAccountPrompt")}{" "}
            <Link
              href="/fromhere/signin"
              className="font-semibold text-primary-readable underline-offset-4 hover:underline"
            >
              {t("hasAccountAction")}
            </Link>
          </p>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <Link href="/fromhere" className="underline-offset-4 hover:underline">
          ← {t("backToFromHere")}
        </Link>
      </div>
    </div>
  )
}
