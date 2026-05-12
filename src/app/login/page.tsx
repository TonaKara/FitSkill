"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NotificationToast } from "@/components/ui/notification-toast"
import {
  buildSignupConfirmationRedirectUrl,
  clearSignupPendingVerificationEmail,
  clearSignupVerificationResent,
  hasSignupVerificationBeenResent,
  markSignupVerificationResent,
  persistSignupPendingVerificationEmail,
  readSignupPendingVerificationEmail,
} from "@/lib/auth-email-flow"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"

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

  const isSignup = mode === "signup"
  const isReset = mode === "reset"
  const isAwaitingSignupVerification = signupVerificationEmail !== null
  const title = useMemo(() => {
    if (isAwaitingSignupVerification) {
      return "メール認証の確誁E
    }
    if (isSignup) {
      return "新規登録"
    }
    if (isReset) {
      return "パスワード�E設宁E
    }
    return "ログイン"
  }, [isAwaitingSignupVerification, isReset, isSignup])
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
  const canResendSignupVerification =
    isAwaitingSignupVerification &&
    !hasSignupVerificationResent &&
    isLikelyEmail(normalizedResendEmail) &&
    !resendEmailChangedFromRegistered

  useEffect(() => {
    if (searchParams.get("error") !== "auth_callback") {
      return
    }

    const reason = searchParams.get("reason")
    let message =
      "メール認証に失敗しました。登録したメールアドレスを確認し、確認メールを�E送してください、E
    if (reason === "missing") {
      message =
        "メール冁E�E認証リンクが不完�Eです。メール全斁E��らリンクを開き直すか、確認メールを�E送してください、E
    } else if (reason === "session_context") {
      message =
        "登録したのと同じブラウザで認証リンクを開ぁE��ください。別端末めE��プリ冁E��ラウザの場合�E、確認メールの再送をお試しください、E
    } else if (reason === "exchange_failed" || reason === "otp_failed") {
      message =
        "認証リンクの有効期限刁E��、また�E既に使用済みの可能性があります。確認メールを�E送してください、E
    }

    const pendingEmail = readSignupPendingVerificationEmail()
    setEmail(pendingEmail ?? "")
    setSignupVerificationEmail(pendingEmail ?? "")
    setIsSignupVerificationRecovery(true)
    setMode("login")
    setNotice(null)
    setVerificationPanelNotice({
      variant: "error",
      message,
    })
    setHasSignupVerificationResent(hasSignupVerificationBeenResent())
  }, [searchParams])

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
        message: "再送�Eのメールアドレスを正しく入力してください、E,
      })
      return
    }

    if (resendEmailChangedFromRegistered) {
      setVerificationPanelNotice({
        variant: "error",
        message:
          "登録時と異なるメールアドレスには再送できません。下�E「このメールアドレスで登録し直す」から新規登録をやり直してください、E,
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
          message: body?.message ?? "確認メールの再送に失敗しました。時間を置ぁE��再度お試しください、E,
        })
        return
      }

      const successMessage = body?.message ?? "確認メールを�E送しました。受信ボックスをご確認ください、E
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
        message: "確認メールの再送に失敗しました。時間を置ぁE��再度お試しください、E,
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
        setNotice({ variant: "error", message: "メールアドレスを�E力してください、E })
        return
      }

      if (!isReset && !password) {
        setNotice({ variant: "error", message: "メールアドレスとパスワードを入力してください、E })
        return
      }

      if (isReset) {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        if (!response.ok && response.status !== 429) {
          throw new Error("パスワード�E設定メールの送信に失敗しました、E)
        }

        setNotice(
          toSuccessNotice("パスワード�E設定用のメールを送信しました。メール冁E�Eリンクをご確認ください、E),
        )
        return
      }

      if (isSignup && !trimmedDisplayName) {
        setNotice({ variant: "error", message: "表示名を入力してください、E })
        return
      }

      if (isSignup && !isEmailMatched) {
        setNotice({
          variant: "error",
          message: "メールアドレス�E�確認用�E�が一致してぁE��せん、E,
        })
        return
      }

      if (isSignup && !passwordRuleState.isValid) {
        setNotice({
          variant: "error",
          message: "パスワード�E8斁E��以上で、大斁E���E小文字�E数字をすべて含めてください、E,
        })
        return
      }

      if (isSignup && !isConfirmMatched) {
        setNotice({
          variant: "error",
          message: "パスワード（確認用�E�が一致してぁE��せん、E,
        })
        return
      }

      const todayStr = formatLocalIsoDate(new Date())
      if (isSignup) {
        const birthdayTrimmed = birthday.trim()
        if (!birthdayTrimmed) {
          setNotice({ variant: "error", message: "誕生日を�E力してください、E })
          return
        }
        if (birthdayTrimmed > todayStr) {
          setNotice({ variant: "error", message: "誕生日に未来の日付�E選択できません、E })
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

        setNotice(toSuccessNotice("ログインに成功しました、E))
        router.push("/")
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
        throw new Error("ユーザー作�Eに失敗しました、E)
      }

      const identities = signUpUser.identities ?? []
      if (identities.length === 0) {
        setNotice({
          variant: "error",
          message:
            "こ�Eメールアドレスは登録済みか、確認メール送信征E��の可能性があります。受信ボックスをご確認ください、E,
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
        // Discord 通知失敗でサインアチE�E自体�E失敗扱ぁE��しなぁE      }

      setNotice(toSuccessNotice("アカウントを作�Eしました。�Eロフィール設定に進みます、E))
      router.push("/profile-setup")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, isAdmin))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,74,25,0.35),transparent_45%),radial-gradient(circle_at_bottom,rgba(230,74,25,0.25),transparent_50%)]" />

      <Card className="relative z-10 w-full max-w-md border-red-500/40 bg-zinc-950/95 shadow-[0_0_60px_rgba(230,74,25,0.25)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e64a19]">
              <BrandMarkSvg className="h-5 w-5" />
            </div>
            <span>
              <span className="text-red-300">Grit</span>
              <span className="text-white">Vib</span>
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-wide text-white">{title}</CardTitle>
            <CardDescription className="mt-1 text-zinc-400">
              {isAwaitingSignupVerification
                ? isSignupVerificationRecovery
                  ? "認証リンクを開けませんでした。登録したメールアドレスを�E力し、確認メールを�E送できます、E
                  : "確認メールのリンクを開ぁE��認証を完亁E��てください。認証後にプロフィール設定へ進みます、E
                : isSignup
                  ? "メールアドレスでアカウントを作�Eします。確認メールのリンクを開ぁE��あと、�Eロフィール設定に進みます、E
                  : isReset
                    ? "登録済みメールアドレス宛に、�E設定リンクを送信します、E
                    : "登録済みのアカウントでGritVibにログインします、E}
            </CardDescription>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-red-500 hover:bg-zinc-800 hover:text-white"
          >
            <Link href="/">ホ�Eムに戻めE/Link>
          </Button>

          {!isAwaitingSignupVerification ? (
          <div className="grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
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
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              ログイン
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
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              新規登録
            </button>
          </div>
          ) : null}
        </CardHeader>

        <CardContent>
          {isAwaitingSignupVerification ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm leading-relaxed text-zinc-100">
                <p className="font-semibold text-emerald-200">
                  {isSignupVerificationRecovery ? "メール認証を完亁E��きませんでした" : "確認メールを送信しました、E}
                </p>
                <p className="mt-3 text-zinc-300">
                  {isSignupVerificationRecovery
                    ? "登録したメールアドレスを�E力し、確認メールを�E送してください。届いた最新のリンクを開ぁE��認証を完亁E��ると、�Eロフィール設定へ進みます、E
                    : "認証用メールを送信しました。メール冁E�Eリンクを開ぁE��認証を完亁E��てください。認証後にプロフィール設定へ進みます、E}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="signup_verification_email">
                  送信先メールアドレス
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
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                <p className="text-xs leading-relaxed text-zinc-400">
                  再送前に宛�Eをご確認ください、E                </p>
                {email.trim().length > 0 && !isLikelyEmail(normalizedResendEmail) ? (
                  <p className="text-xs text-red-400">メールアドレスの形式が正しくありません、E/p>
                ) : null}
                {resendEmailChangedFromRegistered ? (
                  <p className="text-xs text-amber-200">
                    登録時�Eメールアドレス�E�EregisteredSignupEmail}�E�と異なります。別アドレスで受け取るには登録し直してください、E                  </p>
                ) : null}
              </div>

              {verificationPanelNotice ? (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm leading-relaxed",
                    verificationPanelNotice.variant === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-100"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  {verificationPanelNotice.message}
                </div>
              ) : null}

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm text-zinc-300">
                <p className="font-semibold text-zinc-100">メールが届かなぁE��吁E/p>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>迷惑メールフォルダめE�Eロモーションタブをご確認ください、E/li>
                  {hasSignupVerificationResent ? (
                    <>
                      <li>確認メールの再送�E1回までです。届かなぁE��合�Eお問ぁE��わせください、E/li>
                      <li>メールアドレスを間違えた場合�E、「このメールアドレスで登録し直す」をお試しください、E/li>
                    </>
                  ) : (
                    <>
                      <li>数刁E��E��てから、宛�Eを確認して「確認メールを�E送する」をお試しください�E�E回まで�E�、E/li>
                      <li>メールアドレスを間違えた場合�E、�E力欁E��直して「このメールアドレスで登録し直す」をお試しください、E/li>
                    </>
                  )}
                </ul>
              </div>

              {hasSignupVerificationResent ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-100">
                  <p className="font-semibold text-amber-200">確認メールは再送済みでぁE/p>
                  <p className="mt-3 text-amber-100/90">
                    それでも届かなぁE��合�E、下�E「お問い合わせ」からご連絡ください、E                  </p>
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
                    再送中...
                  </>
                ) : hasSignupVerificationResent ? (
                  "確認メールは再送済みでぁE
                ) : (
                  "確認メールを�E送すめE
                )}
              </Button>

              {resendEmailChangedFromRegistered ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-amber-500/50 bg-zinc-900 text-amber-100 hover:bg-zinc-800"
                  onClick={returnToSignupWithEditedEmail}
                >
                  こ�Eメールアドレスで登録し直ぁE                </Button>
              ) : null}

              <Button
                type="button"
                asChild
                variant={hasSignupVerificationResent ? "default" : "outline"}
                className={
                  hasSignupVerificationResent
                    ? "h-11 w-full bg-red-600 text-white hover:bg-red-500"
                    : "h-11 w-full border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                }
              >
                <Link href="/contact">お問ぁE��わせ</Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={returnToLoginFromSignupVerification}
              >
                ログイン画面に戻めE              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="full_name">
                  氏名�E�本名！E                </label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="侁E 山田 太郁E
                  autoComplete="name"
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  ※氏名は安�Eなコミュニティ運営のためにのみ使用され、他�Eユーザーには公開されません�E�表示名�Eみが�E開されます）。ご本人確認と、健全な取引�Eためにご協力をお願いします、E                </p>
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="birthday">
                  誕生日
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
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 [color-scheme:dark] focus-visible:ring-red-500"
                />
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="display_name">
                  表示吁E                </label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="侁E Kenta Trainer"
                  autoComplete="nickname"
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100" htmlFor="email">
                メールアドレス
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
              />
            </div>

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="confirm_email">
                  メールアドレス�E�確認用�E�E                </label>
                <Input
                  id="confirm_email"
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder="確認�Eため同じメールアドレスを�E劁E
                  autoComplete="email"
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                {confirmEmail.length > 0 && !isEmailMatched && (
                  <p className="text-xs text-red-400">メールアドレスが一致してぁE��せん、E/p>
                )}
              </div>
            )}

            {!isReset && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="password">
                  パスワーチE                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? "8斁E��以上�E大斁E��E小文孁E数字を含める" : "パスワードを入劁E}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="border-zinc-700 bg-zinc-900 pr-11 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                    aria-label={showPassword ? "パスワードを隠ぁE : "パスワードを表示"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignup && (
                  <div className="space-y-1 text-xs">
                    {!passwordRuleState.hasMinLength && <p className="text-red-400">8斁E��以上で入力してください、E/p>}
                    {!passwordRuleState.hasUppercase && <p className="text-red-400">英大斁E��が含まれてぁE��せん、E/p>}
                    {!passwordRuleState.hasLowercase && <p className="text-red-400">英小文字が含まれてぁE��せん、E/p>}
                    {!passwordRuleState.hasNumber && <p className="text-red-400">数字が含まれてぁE��せん、E/p>}
                  </div>
                )}
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="confirm_password">
                  パスワード（確認用�E�E                </label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="確認�Eため同じパスワードを入劁E
                    autoComplete="new-password"
                    className="border-zinc-700 bg-zinc-900 pr-11 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                    aria-label={showConfirmPassword ? "確認用パスワードを隠ぁE : "確認用パスワードを表示"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !isConfirmMatched && (
                  <p className="text-xs text-red-400">パスワードが一致してぁE��せん、E/p>
                )}
              </div>
            )}

            {isSignup && (
              <div className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p>
                  表示名�E30日に1回、変更できます。一度設定すると30日間�E変更ができませんのでご注意ください、E                </p>
              </div>
            )}

            {!isSignup && !isReset && (
              <button
                type="button"
                onClick={() => {
                  setMode("reset")
                  setNotice(null)
                  setPassword("")
                }}
                className="w-full text-right text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
              >
                パスワードを忘れた場吁E              </button>
            )}

            {isReset && (
              <button
                type="button"
                onClick={() => {
                  setMode("login")
                  setNotice(null)
                }}
                className="w-full text-right text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
              >
                ログインに戻めE              </button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || isSignupDisabled}
              className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処琁E��...
                </>
              ) : isSignup ? (
                "アカウントを作�E"
              ) : isReset ? (
                "再設定メールを送信"
              ) : (
                "ログイン"
              )}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

