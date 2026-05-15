"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
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
  const [hidePostEmailLoginHelp, setHidePostEmailLoginHelp] = useState(false)
  const peekToastShownRef = useRef(false)
  const authCallbackBridgeSentRef = useRef(false)

  const isSignup = mode === "signup"
  const isReset = mode === "reset"
  const isAwaitingSignupVerification = signupVerificationEmail !== null
  const title = useMemo(() => {
    if (isAwaitingSignupVerification) {
      return isSignupVerificationRecovery ? "ログインへ進む" : "メール確認の案内"
    }
    if (isSignup) {
      return "新規登録"
    }
    if (isReset) {
      return "パスワード再設定"
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
    setNotice(toSuccessNotice("登録したメールアドレスとパスワードでログインすると、プロフィール設定に進めます。"))
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
    setNotice(toSuccessNotice("登録したメールアドレスとパスワードでログインすると、プロフィール設定に進めます。"))
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
                  "登録したメールアドレスとパスワードでログインすると、プロフィール設定に進めます。",
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
        message: "再送先のメールアドレスを正しく入力してください。",
      })
      return
    }

    if (resendEmailChangedFromRegistered) {
      setVerificationPanelNotice({
        variant: "error",
        message:
          "登録時と異なるメールアドレスには再送できません。下の「このメールアドレスで登録し直す」から新規登録をやり直してください。",
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
          message: body?.message ?? "確認メールの再送に失敗しました。時間を置いて再度お試しください。",
        })
        return
      }

      const successMessage = body?.message ?? "確認メールを再送しました。受信ボックスをご確認ください。"
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
        message: "確認メールの再送に失敗しました。時間を置いて再度お試しください。",
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
        setNotice({ variant: "error", message: "メールアドレスを入力してください。" })
        return
      }

      if (!isReset && !password) {
        setNotice({ variant: "error", message: "メールアドレスとパスワードを入力してください。" })
        return
      }

      if (isReset) {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        if (!response.ok && response.status !== 429) {
          throw new Error("パスワード再設定メールの送信に失敗しました。")
        }

        setNotice(
          toSuccessNotice("パスワード再設定用のメールを送信しました。メール内のリンクをご確認ください。"),
        )
        return
      }

      if (isSignup && !trimmedDisplayName) {
        setNotice({ variant: "error", message: "表示名を入力してください。" })
        return
      }

      if (isSignup && !isEmailMatched) {
        setNotice({
          variant: "error",
          message: "メールアドレス（確認用）が一致していません。",
        })
        return
      }

      if (isSignup && !passwordRuleState.isValid) {
        setNotice({
          variant: "error",
          message: "パスワードは8文字以上で、大文字・小文字・数字をすべて含めてください。",
        })
        return
      }

      if (isSignup && !isConfirmMatched) {
        setNotice({
          variant: "error",
          message: "パスワード（確認用）が一致していません。",
        })
        return
      }

      const todayStr = formatLocalIsoDate(new Date())
      if (isSignup) {
        const birthdayTrimmed = birthday.trim()
        if (!birthdayTrimmed) {
          setNotice({ variant: "error", message: "誕生日を入力してください。" })
          return
        }
        if (birthdayTrimmed > todayStr) {
          setNotice({ variant: "error", message: "誕生日に未来の日付は選択できません。" })
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

        setNotice(toSuccessNotice("ログインに成功しました。"))
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
        throw new Error("ユーザー作成に失敗しました。")
      }

      const identities = signUpUser.identities ?? []
      if (identities.length === 0) {
        setNotice({
          variant: "error",
          message:
            "このメールアドレスは登録済みか、確認メール送信待ちの可能性があります。受信ボックスをご確認ください。",
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

      setNotice(toSuccessNotice("アカウントを作成しました。プロフィール設定に進みます。"))
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
                  ? "ログインするとプロフィール設定に進めます。うまくいかないときの案内は下記をご覧ください。"
                  : "確認メールのリンクを開いて認証を完了してください。認証後にプロフィール設定へ進みます。"
                : isSignup
                  ? "メールアドレスでアカウントを作成します。確認メールのリンクを開いたあと、プロフィール設定に進みます。"
                  : isReset
                    ? "登録済みメールアドレス宛に、再設定リンクを送信します。"
                    : "登録済みのアカウントでGritVibにログインします。"}
            </CardDescription>
          </div>

          <Button
            asChild
            variant="outline"
            className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-red-500 hover:bg-zinc-800 hover:text-white"
          >
            <Link href="/">ホームに戻る</Link>
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
                  {isSignupVerificationRecovery
                    ? "メールの確認は、リンクを開いたら完了していることがほとんどです"
                    : "確認メールを送信しました。"}
                </p>
                <p className="mt-3 text-zinc-300">
                  {isSignupVerificationRecovery
                    ? "登録したメールアドレスとパスワードでログインすると、プロフィール設定に進めます。"
                    : "認証用メールを送信しました。メール内のリンクを開いて認証を完了してください。認証後にプロフィール設定へ進みます。"}
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
                  再送前に宛先をご確認ください。
                </p>
                {email.trim().length > 0 && !isLikelyEmail(normalizedResendEmail) ? (
                  <p className="text-xs text-red-400">メールアドレスの形式が正しくありません。</p>
                ) : null}
                {resendEmailChangedFromRegistered ? (
                  <p className="text-xs text-amber-200">
                    登録時のメールアドレス（{registeredSignupEmail}）と異なります。別アドレスで受け取るには登録し直してください。
                  </p>
                ) : null}
              </div>

              {verificationPanelNotice ? (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
                    verificationPanelNotice.variant === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-100"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                  )}
                >
                  {verificationPanelNotice.message}
                </div>
              ) : null}

              {isSignupVerificationRecovery ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm text-zinc-300">
                  <p className="font-semibold text-zinc-100">ログインができない場合</p>
                  <p className="mt-2 leading-relaxed text-zinc-400">
                    確認メールのリンクを開いているのにログインできないときは、次を順にお試しください。
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>メールアドレスとパスワードの入力ミスがないかご確認ください。</li>
                    <li>迷惑メールフォルダやプロモーションタブをご確認ください。</li>
                    {hasSignupVerificationResent ? (
                      <>
                        <li>確認メールの再送は1回までです。届かない場合はお問い合わせください。</li>
                        <li>メールアドレスを間違えて登録した場合は、「このメールアドレスで登録し直す」をお試しください。</li>
                      </>
                    ) : (
                      <>
                        <li>数分待ってから、宛先を確認のうえ「確認メールを再送する」をお試しください（1回まで）。</li>
                        <li>メールアドレスを間違えて登録した場合は、入力欄を直して「このメールアドレスで登録し直す」をお試しください。</li>
                      </>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-4 text-sm text-zinc-300">
                  <p className="font-semibold text-zinc-100">メールが届かない場合</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    <li>迷惑メールフォルダやプロモーションタブをご確認ください。</li>
                    {hasSignupVerificationResent ? (
                      <>
                        <li>確認メールの再送は1回までです。届かない場合はお問い合わせください。</li>
                        <li>メールアドレスを間違えた場合は、「このメールアドレスで登録し直す」をお試しください。</li>
                      </>
                    ) : (
                      <>
                        <li>数分待ってから、宛先を確認して「確認メールを再送する」をお試しください（1回まで）。</li>
                        <li>メールアドレスを間違えた場合は、入力欄を直して「このメールアドレスで登録し直す」をお試しください。</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              {hasSignupVerificationResent ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-100">
                  <p className="font-semibold text-amber-200">確認メールは再送済みです</p>
                  <p className="mt-3 text-amber-100/90">
                    それでも届かない場合は、下の「お問い合わせ」からご連絡ください。
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
                    再送中...
                  </>
                ) : hasSignupVerificationResent ? (
                  "確認メールは再送済みです"
                ) : (
                  "確認メールを再送する"
                )}
              </Button>

              {resendEmailChangedFromRegistered ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-amber-500/50 bg-zinc-900 text-amber-100 hover:bg-zinc-800"
                  onClick={returnToSignupWithEditedEmail}
                >
                  このメールアドレスで登録し直す
                </Button>
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
                <Link href="/contact">お問い合わせ</Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={returnToLoginFromSignupVerification}
              >
                ログイン画面に戻る
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="full_name">
                  氏名（本名）
                </label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="例: 山田 太郎"
                  autoComplete="name"
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  ※氏名は安全なコミュニティ運営のためにのみ使用され、他のユーザーには公開されません（表示名のみが公開されます）。ご本人確認と、健全な取引のためにご協力をお願いします。
                </p>
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
                  表示名
                </label>
                <Input
                  id="display_name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="例: Kenta Trainer"
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
                  メールアドレス（確認用）
                </label>
                <Input
                  id="confirm_email"
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder="確認のため同じメールアドレスを入力"
                  autoComplete="email"
                  className="border-zinc-700 bg-zinc-900 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                {confirmEmail.length > 0 && !isEmailMatched && (
                  <p className="text-xs text-red-400">メールアドレスが一致していません。</p>
                )}
              </div>
            )}

            {!isReset && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="password">
                  パスワード
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? "8文字以上・大文字/小文字/数字を含める" : "パスワードを入力"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="border-zinc-700 bg-zinc-900 pr-11 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                    aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignup && (
                  <div className="space-y-1 text-xs">
                    {!passwordRuleState.hasMinLength && <p className="text-red-400">8文字以上で入力してください。</p>}
                    {!passwordRuleState.hasUppercase && <p className="text-red-400">英大文字が含まれていません。</p>}
                    {!passwordRuleState.hasLowercase && <p className="text-red-400">英小文字が含まれていません。</p>}
                    {!passwordRuleState.hasNumber && <p className="text-red-400">数字が含まれていません。</p>}
                  </div>
                )}
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100" htmlFor="confirm_password">
                  パスワード（確認用）
                </label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="確認のため同じパスワードを入力"
                    autoComplete="new-password"
                    className="border-zinc-700 bg-zinc-900 pr-11 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                    aria-label={showConfirmPassword ? "確認用パスワードを隠す" : "確認用パスワードを表示"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !isConfirmMatched && (
                  <p className="text-xs text-red-400">パスワードが一致していません。</p>
                )}
              </div>
            )}

            {isSignup && (
              <div className="flex items-start gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p>
                  表示名は30日に1回、変更できます。一度設定すると30日間は変更ができませんのでご注意ください。
                </p>
              </div>
            )}

            {!isSignup && !isReset && (
              <div className="space-y-3">
                {canShowPostEmailLoginHelp ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-3 text-xs leading-relaxed text-zinc-300">
                    <p className="font-semibold text-zinc-100">ログインができない場合</p>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4">
                      <li>メールアドレスとパスワードの入力ミスがないかご確認ください。</li>
                      <li>パスワードを忘れた場合は、下の「パスワードを忘れた場合」から再設定できます。</li>
                      <li>
                        それでも解決しない場合は{" "}
                        <Link href="/contact" className="text-red-400 underline hover:text-red-300">
                          お問い合わせ
                        </Link>
                        からご連絡ください。
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        markPostEmailConfirmLoginHelpDone()
                        setHidePostEmailLoginHelp(true)
                      }}
                      className="mt-3 w-full text-left text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                    >
                      この案内を表示しない
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
                  className="w-full text-right text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
                >
                  パスワードを忘れた場合
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
                className="w-full text-right text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
              >
                ログインに戻る
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
                  処理中...
                </>
              ) : isSignup ? (
                "アカウントを作成"
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

