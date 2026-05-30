"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"

type SignInMode = "signin" | "reset"

/** FromHere 専用のサインインページ。
 *
 * - GritVib 本体の Supabase Auth と同じ認証を使い、共通の `auth.users` を共有する。
 * - ログイン後、`newvibes_profiles` が未作成なら `/fromhere/onboarding`、作成済みなら `/fromhere` へ。
 * - パスワード再設定は本体と同じ `/api/auth/password-reset` を呼び、`/auth/update-password` に着地させる。
 */
export default function FromHereSignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("fromhere.auth")
  const tToast = useTranslations("fromhere.auth.toasts")

  const { user, profile, loading: authLoading } = useFromHereAuth()

  /**
   * `next` query: ログイン後の遷移先。
   * オープンリダイレクト防止のため `/fromhere/` 始まりの相対 URL のみ許可する。
   * （外部 URL や `//evil.example` のようなプロトコル相対 URL は弾く）
   */
  const nextParam = searchParams.get("next") ?? ""
  const safeNextPath = useMemo(() => {
    if (!nextParam) return null
    if (!nextParam.startsWith("/fromhere")) return null
    if (nextParam.startsWith("//")) return null
    if (nextParam.startsWith("/fromhere/signin")) return null
    return nextParam
  }, [nextParam])

  const [mode, setMode] = useState<SignInMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const redirectedRef = useRef(false)

  const isReset = mode === "reset"

  /** signup 完了 → メール確認後にこのページへ戻ってきたケースの軽い告知 */
  useEffect(() => {
    if (searchParams.get("signup_verified") === "1" && !notice) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URLクエリからの一度きりの告知反映
      setNotice(toSuccessNotice(tToast("signupSuccess")))
    }
  }, [searchParams, tToast, notice])

  /** 既ログイン時の自動リダイレクト */
  useEffect(() => {
    if (authLoading || redirectedRef.current) {
      return
    }
    if (!user) {
      return
    }
    redirectedRef.current = true
    // 既ログイン時: profile があれば safeNext or /fromhere、未作成なら onboarding に誘導
    const target = profile ? safeNextPath ?? "/fromhere" : "/fromhere/onboarding"
    router.replace(target)
  }, [authLoading, user, profile, router, safeNextPath])

  const title = useMemo(() => (isReset ? t("resetTitle") : t("signinTitle")), [isReset, t])
  const subtitle = useMemo(() => (isReset ? t("resetSubtitle") : t("signinSubtitle")), [isReset, t])

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

      if (isReset) {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        if (!response.ok && response.status !== 429) {
          throw new Error(tToast("resetMailFailed"))
        }
        setNotice(toSuccessNotice(tToast("resetMailSent")))
        return
      }

      if (!password) {
        setNotice({ variant: "error", message: tToast("passwordRequired") })
        return
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error || !signInData.user?.id) {
        setNotice({ variant: "error", message: tToast("signinFailed") })
        return
      }

      setNotice(toSuccessNotice(tToast("signinSuccess")))
      redirectedRef.current = true
      const { data: existingProfile } = await supabase
        .from("newvibes_profiles")
        .select("id")
        .eq("id", signInData.user.id)
        .maybeSingle()
      // profile 未作成は onboarding 優先。作成済みなら next を尊重。
      const target = existingProfile
        ? safeNextPath ?? "/fromhere"
        : "/fromhere/onboarding"
      router.replace(target)
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 md:py-16">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <Card className="border-border bg-card shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-bold text-foreground">{title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_email">
                {t("email")}
              </label>
              <Input
                id="fromhere_email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                className="border-input bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {!isReset ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="fromhere_password">
                  {t("password")}
                </label>
                <div className="relative">
                  <Input
                    id="fromhere_password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("passwordPlaceholderLogin")}
                    autoComplete="current-password"
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
              </div>
            ) : null}

            {!isReset ? (
              <button
                type="button"
                onClick={() => {
                  setMode("reset")
                  setNotice(null)
                  setPassword("")
                }}
                className="block w-full text-right text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary-readable hover:underline"
              >
                {t("forgotPassword")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("signin")
                  setNotice(null)
                }}
                className="block w-full text-right text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary-readable hover:underline"
              >
                {t("returnToLogin")}
              </button>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : isReset ? (
                t("submitReset")
              ) : (
                t("submitSignin")
              )}
            </Button>
          </form>

          {!isReset ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("noAccountPrompt")}{" "}
              <Link
                href="/fromhere/signup"
                className="font-semibold text-primary-readable underline-offset-4 hover:underline"
              >
                {t("noAccountAction")}
              </Link>
            </p>
          ) : null}
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
