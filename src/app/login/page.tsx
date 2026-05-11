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
import { buildAuthCallbackRedirectUrl } from "@/lib/auth-email-flow"
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

  const isSignup = mode === "signup"
  const isReset = mode === "reset"
  const title = useMemo(() => {
    if (isSignup) {
      return "新規登録"
    }
    if (isReset) {
      return "パスワード再設定"
    }
    return "ログイン"
  }, [isReset, isSignup])
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

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback") {
      setNotice({
        variant: "error",
        message: "メール認証に失敗しました。リンクの有効期限が切れている可能性があります。再度登録するか、ログインをお試しください。",
      })
    }
  }, [searchParams])

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

        setNotice(toSuccessNotice("ログインに成功しました。"))
        router.push("/")
        router.refresh()
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: buildAuthCallbackRedirectUrl("/profile-setup"),
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
        setNotice(
          toSuccessNotice(
            "確認メールを送信しました。メール内のリンクを開いて認証を完了してから、プロフィール設定に進んでください。",
          ),
        )
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,40,40,0.35),transparent_45%),radial-gradient(circle_at_bottom,rgba(198,40,40,0.25),transparent_50%)]" />

      <Card className="relative z-10 w-full max-w-md border-red-500/40 bg-zinc-950/95 shadow-[0_0_60px_rgba(198,40,40,0.25)]">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#c62828] text-white">
              <BrandMarkSvg className="h-5 w-5 text-white" />
            </div>
            <span>
              <span className="text-red-300">Grit</span>
              <span className="text-white">Vib</span>
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-wide text-white">{title}</CardTitle>
            <CardDescription className="mt-1 text-zinc-400">
              {isSignup
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

          <div className="grid grid-cols-2 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setNotice(null)
                setConfirmEmail("")
                setConfirmPassword("")
                setPassword("")
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                mode === "login"
                  ? "bg-red-600 text-white shadow-[0_0_22px_rgba(198,40,40,0.45)]"
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
                setConfirmEmail("")
                setConfirmPassword("")
                setPassword("")
              }}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                mode === "signup"
                  ? "bg-red-600 text-white shadow-[0_0_22px_rgba(198,40,40,0.45)]"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              新規登録
            </button>
          </div>
        </CardHeader>

        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}

