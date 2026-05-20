"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/useI18n"

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
  const t = useTranslations("updatePassword")
  const tLogin = useTranslations("login")
  const tToasts = useTranslations("authToasts")
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
        message: tToasts("passwordPolicy"),
      })
      return
    }

    if (!isConfirmMatched) {
      setNotice({
        variant: "error",
        message: tToasts("passwordConfirmMismatch"),
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

      setNotice(toSuccessNotice(tToasts("passwordUpdated")))
      router.push("/")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell>
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}

      <Card className="relative z-10 w-full max-w-md border-border bg-card shadow-lg dark:border-red-500/40 dark:bg-zinc-950/95 dark:shadow-[0_0_60px_rgba(230,74,25,0.25)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-wide text-foreground">{t("title")}</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">
            {t("subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new_password">
                {t("newPassword")}
              </label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
                  autoComplete="new-password"
                  className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                  aria-label={showPassword ? t("passwordToggleHide") : t("passwordToggleShow")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1 text-xs">
                {!passwordRuleState.hasMinLength && <p className="text-red-400">{tLogin("passwordRuleMin")}</p>}
                {!passwordRuleState.hasUppercase && <p className="text-red-400">{tLogin("passwordRuleUpper")}</p>}
                {!passwordRuleState.hasLowercase && <p className="text-red-400">{tLogin("passwordRuleLower")}</p>}
                {!passwordRuleState.hasNumber && <p className="text-red-400">{tLogin("passwordRuleNumber")}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="confirm_password">
                {t("newPasswordConfirm")}
              </label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("newPasswordConfirmPlaceholder")}
                  autoComplete="new-password"
                  className="border-input bg-background pr-11 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((previous) => !previous)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-red-300"
                  aria-label={showConfirmPassword ? t("passwordConfirmToggleHide") : t("passwordConfirmToggleShow")}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !isConfirmMatched && (
                <p className="text-xs text-red-400">{t("passwordMismatch")}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-red-600 text-white hover:bg-red-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}
