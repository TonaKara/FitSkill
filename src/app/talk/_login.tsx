"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { TalkAuthShell } from "@/talk/_auth-shell"
import { TalkPasswordField } from "@/talk/_password-field"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { readSignupPendingVerificationEmail } from "@/lib/auth-email-flow"
import { resolveGritvibPostAuthPath } from "@/lib/talk/post-auth-redirect"
import { safeClientLogError } from "@/lib/safe-client-log"

type LoginMode = "login" | "reset"

const PASSWORD_RESET_SENT_MESSAGE =
  "メールを送信しました。受信ボックスをご確認ください。"

/**
 * GritVib (人間チャットサービス) のログイン画面。
 *
 * 認証は Supabase の `signInWithPassword`。成功後は会員状態に応じて遷移する。
 *   - 管理者 → `/talk/admin`
 *   - 会員未登録 → `/talk/onboard`
 *   - それ以外 → `/talk/chat`
 *   - パスワード再設定は `/api/auth/password-reset`（PKCE 非依存の recovery リンク）を利用。
 */
export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  useEffect(() => {
    if (searchParams.get("signup_verified") !== "1") return
    const pending = readSignupPendingVerificationEmail()
    if (pending) setEmail(pending)
    setSuccessMessage(
      "メールアドレスの確認が完了しました。パスワードを入力してログインしてください。",
    )
    router.replace("/talk/login", { scroll: false })
  }, [router, searchParams])

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
      setErrorMessage("メールアドレスの形式が正しくありません。")
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
        setSuccessMessage(body?.message ?? PASSWORD_RESET_SENT_MESSAGE)
      } catch (err) {
        safeClientLogError("[talk/login] password reset failed")
        setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。")
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (password.length === 0) {
      setErrorMessage("パスワードを入力してください。")
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
        setErrorMessage(translateSignInError(error.message))
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
      setErrorMessage("ログインに失敗しました。時間をおいて再度お試しください。")
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
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-zinc-500 hover:text-zinc-900"
            >
              GritVib
            </Link>
            <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
              {isReset ? "パスワードの再設定" : "ログイン"}
            </h1>
            {isReset ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                登録したメールアドレスを入力してください。再設定用のリンクをお送りします。
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-black"
              >
                メールアドレス
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
                label="パスワード"
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
                  {isReset ? "送信中…" : "ログイン中…"}
                </>
              ) : isReset ? (
                "再設定メールを送る"
              ) : (
                "ログイン"
              )}
            </button>

            {!isReset ? (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                disabled={isSubmitting}
                className="block w-full text-center text-sm text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                パスワードをお忘れですか？
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                disabled={isSubmitting}
                className="block w-full text-center text-sm text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                ログインに戻る
              </button>
            )}

            {!isReset ? (
              <p className="text-center text-sm text-zinc-600">
                アカウントをお持ちでないですか？{" "}
                <Link
                  href="/talk/register"
                  className="text-black underline-offset-4 hover:underline"
                >
                  はじめる
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

function translateSignInError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("email not confirmed")) {
    return "メールアドレスがまだ確認されていません。確認メールのリンクから登録を完了してください。"
  }
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid")) {
    return "メールアドレスまたはパスワードが正しくありません。"
  }
  if (normalized.includes("rate") || normalized.includes("limit")) {
    return "リクエストが集中しています。少し時間をおいて再度お試しください。"
  }
  return "ログインに失敗しました。時間をおいて再度お試しください。"
}
