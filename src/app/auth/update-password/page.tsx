"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const PASSWORD_MIN_LENGTH = 8

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

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordRuleState = useMemo(() => getPasswordRuleState(password), [password])
  const isConfirmMatched = confirmPassword.length > 0 && password === confirmPassword

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)

    if (!passwordRuleState.isValid) {
      setNotice({
        variant: "error",
        message: "パスワードは8文字以上で、大文字・小文字・数字をすべて含めてください。",
      })
      return
    }

    if (!isConfirmMatched) {
      setNotice({
        variant: "error",
        message: "パスワード（確認用）が一致していません。",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw error
      }

      setNotice(toSuccessNotice("パスワードを更新しました。ダッシュボードへ移動します。"))
      router.push("/mypage")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12 text-white">
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,74,25,0.35),transparent_45%),radial-gradient(circle_at_bottom,rgba(230,74,25,0.25),transparent_50%)]" />

      <Card className="relative z-10 w-full max-w-md border-red-500/40 bg-zinc-950/95 shadow-[0_0_60px_rgba(230,74,25,0.25)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-wide text-white">パスワード更新</CardTitle>
          <CardDescription className="mt-1 text-zinc-400">
            新しいパスワードを設定して、アカウントへログインしてください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100" htmlFor="new_password">
                新しいパスワード
              </label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="8文字以上・大文字/小文字/数字を含める"
                  autoComplete="new-password"
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
              <div className="space-y-1 text-xs">
                {!passwordRuleState.hasMinLength && <p className="text-red-400">8文字以上で入力してください。</p>}
                {!passwordRuleState.hasUppercase && <p className="text-red-400">英大文字が含まれていません。</p>}
                {!passwordRuleState.hasLowercase && <p className="text-red-400">英小文字が含まれていません。</p>}
                {!passwordRuleState.hasNumber && <p className="text-red-400">数字が含まれていません。</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100" htmlFor="confirm_password">
                新しいパスワード（確認用）
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

            <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-red-600 text-white hover:bg-red-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : (
                "パスワードを更新"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
