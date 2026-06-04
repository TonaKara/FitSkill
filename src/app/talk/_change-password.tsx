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
  describeAuthPasswordPolicyError,
  getPasswordRuleState,
  translatePasswordUpdateError,
} from "@/lib/auth/password-policy"
type ChangePasswordPageProps = {
  isAdmin: boolean
  returnPath: string
}

/**
 * ログイン中の本人のみパスワード変更可能。
 * 現在のパスワードで再認証してから `updateUser` する（セッション乗っ取りのみでは変更不可）。
 */
export function ChangePasswordPage({ isAdmin, returnPath }: ChangePasswordPageProps) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

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
      setErrorMessage("現在のパスワードを入力してください。")
      return
    }
    if (!passwordRuleState.isValid) {
      setErrorMessage(describeAuthPasswordPolicyError())
      return
    }
    if (!isConfirmMatched) {
      setErrorMessage("確認用パスワードが一致しません。")
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
        setErrorMessage("セッションが切れました。再度ログインしてください。")
        return
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (reauthError) {
        safeClientLogError("[talk/change-password] reauth failed")
        setErrorMessage(translatePasswordUpdateError(reauthError.message))
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        safeClientLogError("[talk/change-password] update failed")
        setErrorMessage(translatePasswordUpdateError(updateError.message))
        return
      }

      setSuccessMessage("パスワードを変更しました。")
      setCurrentPassword("")
      setPassword("")
      setPasswordConfirm("")
      window.setTimeout(() => {
        router.replace(returnPath)
        router.refresh()
      }, 1200)
    } catch {
      safeClientLogError("[talk/change-password] unexpected error")
      setErrorMessage("パスワードの変更に失敗しました。時間をおいて再度お試しください。")
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
          戻る
        </Link>

        <h1 className="text-xl font-semibold tracking-tight text-black">パスワードを変更</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ログイン中のアカウント本人のみ変更できます。現在のパスワードの入力が必要です。
        </p>
        {isAdmin ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            管理者アカウントも同じ手順です。他人のパスワードを変更する機能はありません。MFA
            の設定をあわせておすすめします。
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <TalkPasswordField
            id="current-password"
            label="現在のパスワード"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={isSubmitting}
            required
          />

          <TalkPasswordField
            id="new-password"
            label="新しいパスワード"
            autoComplete="new-password"
            placeholder={`${AUTH_PASSWORD_MIN_LENGTH} 文字以上・英大小・数字`}
            value={password}
            onChange={setPassword}
            disabled={isSubmitting}
            required
          />
          <div className="space-y-1 text-xs text-zinc-500">
            {!passwordRuleState.hasMinLength && password.length > 0 ? (
              <p>8 文字以上にしてください。</p>
            ) : null}
            {!passwordRuleState.hasUppercase && password.length > 0 ? (
              <p>英大文字を含めてください。</p>
            ) : null}
            {!passwordRuleState.hasLowercase && password.length > 0 ? (
              <p>英小文字を含めてください。</p>
            ) : null}
            {!passwordRuleState.hasNumber && password.length > 0 ? (
              <p>数字を含めてください。</p>
            ) : null}
          </div>

          <TalkPasswordField
            id="confirm-password"
            label="新しいパスワード（確認）"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            disabled={isSubmitting}
            required
          />
          {passwordConfirm.length > 0 && !isConfirmMatched ? (
            <p className="text-xs text-red-600">確認用パスワードが一致しません。</p>
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
                変更中…
              </>
            ) : (
              "パスワードを変更"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          現在のパスワードがわからない場合は{" "}
          <button
            type="button"
            onClick={() => void handleLoginForPasswordReset()}
            disabled={isSubmitting || signingOutForLogin}
            className="text-black underline underline-offset-2 transition-colors hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOutForLogin ? "ログアウト中…" : "ログイン画面"}
          </button>
          から再設定メールを送信してください。
        </p>
      </div>
    </TalkAuthShell>
  )
}
