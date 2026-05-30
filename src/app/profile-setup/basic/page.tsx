"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** YYYY-MM-DD (ローカル) フォーマット。`input[type=date]` の max 値に使う */
function formatLocalIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** /profile-setup の前段に挟む「本体プロフィールの必須基本情報」入力ページ。
 *
 *  - FromHere 経由など、本体の signup フォームを通っていないユーザーは
 *    `auth.users.raw_user_meta_data.birthday` などが未設定のままになる。
 *  - 本ページで `display_name` / `full_name` / `birthday` を入力させ、
 *    `auth.updateUser({ data })` と `profiles.display_name` を同時に更新する。
 *  - 既に `user_metadata.birthday` がある場合は何もせず `/profile-setup` へ送る
 *    （循環防止用の自動スキップ）。
 */
export default function ProfileSetupBasicPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("profileBasicInfo")
  const tCommon = useTranslations("common")
  const tToasts = useTranslations("profileBasicInfo.toasts")

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  const [displayName, setDisplayName] = useState("")
  const [fullName, setFullName] = useState("")
  const [birthday, setBirthday] = useState("")

  const redirectedRef = useRef(false)
  const todayIsoDate = useMemo(() => formatLocalIsoDate(new Date()), [])

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user) {
        router.replace("/login")
        return
      }
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        router.replace("/login")
        return
      }

      const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const metaBirthday = typeof metadata.birthday === "string" ? metadata.birthday.trim() : ""
      // 既に基本情報が揃っていれば本ページをスキップして /profile-setup へ
      if (metaBirthday.length > 0) {
        redirectedRef.current = true
        router.replace("/profile-setup")
        return
      }

      // 初期値を user_metadata / profiles から取得
      const metaDisplayName =
        typeof metadata.display_name === "string" ? metadata.display_name.trim() : ""
      const metaFullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : ""
      setFullName(metaFullName)

      // profiles.display_name を初期値に使う。無ければ user_metadata.display_name にフォールバック
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle()
      if (!mounted) {
        return
      }
      const rawProfileDisplayName =
        typeof profileRow?.display_name === "string" ? profileRow.display_name.trim() : ""
      setDisplayName(rawProfileDisplayName || metaDisplayName)
      setUserId(data.user.id)
      setAuthLoading(false)
    }

    void checkAuth()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  const canSubmit =
    !saving && !authLoading && displayName.trim().length > 0 && birthday.trim().length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }
    setNotice(null)

    const trimmedDisplayName = displayName.trim()
    const trimmedFullName = fullName.trim()
    const trimmedBirthday = birthday.trim()

    if (!trimmedDisplayName) {
      setNotice({ variant: "error", message: tToasts("displayNameRequired") })
      return
    }
    if (!trimmedBirthday) {
      setNotice({ variant: "error", message: tToasts("birthdayRequired") })
      return
    }
    if (trimmedBirthday > todayIsoDate) {
      setNotice({ variant: "error", message: tToasts("birthdayFuture") })
      return
    }

    setSaving(true)
    try {
      const { error: updateUserError } = await supabase.auth.updateUser({
        data: {
          display_name: trimmedDisplayName,
          full_name: trimmedFullName || null,
          birthday: trimmedBirthday,
        },
      })
      if (updateUserError) {
        throw updateUserError
      }

      // profiles.display_name も同期させる（プロフィール画面など本体機能で参照される）
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ display_name: trimmedDisplayName })
        .eq("id", userId)
      if (updateProfileError) {
        throw updateProfileError
      }

      setNotice({ variant: "success", message: tToasts("saved") })
      redirectedRef.current = true
      router.replace("/profile-setup")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false, { unknownErrorMessage: tToasts("saveFailed") }))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden />
        {tCommon("loading")}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-8 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="mx-auto max-w-xl">
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <label htmlFor="basic-display-name" className="text-sm font-bold text-foreground">
              {t("displayName")}
            </label>
            <Input
              id="basic-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t("displayNamePlaceholder")}
              autoComplete="nickname"
              maxLength={50}
              className="mt-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("displayNameHelp")}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <label htmlFor="basic-full-name" className="text-sm font-bold text-foreground">
              {t("fullName")}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("fullNameOptional")}
              </span>
            </label>
            <Input
              id="basic-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={t("fullNamePlaceholder")}
              autoComplete="name"
              maxLength={100}
              className="mt-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("fullNameHelp")}</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <label htmlFor="basic-birthday" className="text-sm font-bold text-foreground">
              {t("birthday")}
            </label>
            <Input
              id="basic-birthday"
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
              className="mt-2 border-input bg-background text-foreground dark:[color-scheme:dark] focus-visible:ring-red-500"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("birthdayHelp")}</p>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
