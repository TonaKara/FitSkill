"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Save,
  Trash2,
  UserCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { ThumbnailCropModal } from "@/components/thumbnail-crop-modal"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { AVATARS_STORAGE_BUCKET } from "@/lib/avatar-storage"
import { PROFILE_AVATAR_CROP_EXPORT_PX } from "@/lib/profile-avatar"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import {
  FROMHERE_BIO_MAX_LENGTH,
  FROMHERE_DISPLAY_NAME_MAX,
  validateFromHereProfileEdit,
  type FromHereProfileEditErrorKey,
} from "@/fromhere/_profile-validation"
import { updateFromHereProfileAction } from "@/fromhere/_profile-actions"
import {
  validateFromHereAvatarFile,
  type FromHereAvatarFileErrorKey,
} from "@/fromhere/_avatar-validation"

/** ----------------------------------------------------------
 *  /fromhere/settings — アカウント設定
 *
 *  セキュリティ方針:
 *  - 認証は SSR (`app/fromhere/settings/page.tsx`) で済んでいる前提。
 *  - 全ての sensitive 操作は Supabase の `auth.updateUser` 等を **クライアントから直接** 呼ぶ。
 *    Supabase Auth は最新セッションで cookie を更新するため、サーバ側 RLS と整合性が保たれる。
 *  - 短時間連打を防ぐためフォーム submit 中は disabled。サーバ側のレートリミットは Supabase 側で実施される。
 *  - パスワード入力は `autoComplete="new-password"`、ブラウザのパスワードマネージャーにヒントを渡す。
 *  - プロフィール（表示名 / 自己紹介 / アバター画像）も同ページで編集可能。
 *    アバターは本体と共通の `avatars` バケットへアップロードし、URL を
 *    `/api/fromhere/profile` PATCH 経由で `newvibes_profiles.avatar_url` に保存する。
 * ---------------------------------------------------------- */

const PASSWORD_MIN_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** SSR から渡される自分のプロフィール初期値。 */
export type SettingsInitialProfile = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
}

type Props = {
  initialEmail: string
  initialProfile: SettingsInitialProfile
}

export function SettingsPageClient({ initialEmail, initialProfile }: Props) {
  const router = useRouter()
  const t = useTranslations("fromhere.settings")
  const tPassword = useTranslations("fromhere.settings.password")
  const tPasswordErr = useTranslations("fromhere.settings.password.errors")
  const tEmail = useTranslations("fromhere.settings.email")
  const tEmailErr = useTranslations("fromhere.settings.email.errors")
  const tSession = useTranslations("fromhere.settings.session")
  const tDanger = useTranslations("fromhere.settings.danger")
  const tLanguage = useTranslations("fromhere.settings.language")

  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="space-y-6">
        {/* プロフィール（画像 / 表示名 / 自己紹介） */}
        <ProfileSection initial={initialProfile} onNotice={setNotice} />

        {/* 言語 */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" aria-hidden />
              {tLanguage("heading")}
            </CardTitle>
            <CardDescription>{tLanguage("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher variant="compact" />
          </CardContent>
        </Card>

        {/* パスワード */}
        <PasswordSection
          headingNode={
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              {tPassword("heading")}
            </CardTitle>
          }
          descriptionNode={<CardDescription>{tPassword("description")}</CardDescription>}
          labels={{
            newLabel: tPassword("newLabel"),
            newPlaceholder: tPassword("newPlaceholder"),
            confirmLabel: tPassword("confirmLabel"),
            confirmPlaceholder: tPassword("confirmPlaceholder"),
            submit: tPassword("submit"),
            submitting: tPassword("submitting"),
            show: tPassword("show"),
            hide: tPassword("hide"),
            successToast: tPassword("successToast"),
          }}
          errorLabels={{
            policy: tPasswordErr("policy"),
            mismatch: tPasswordErr("mismatch"),
            weak: tPasswordErr("weak"),
            samePassword: tPasswordErr("samePassword"),
            rateLimited: tPasswordErr("rateLimited"),
            sessionExpired: tPasswordErr("sessionExpired"),
            failed: tPasswordErr("failed"),
          }}
          onNotice={setNotice}
        />

        {/* メールアドレス */}
        <EmailSection
          currentEmail={initialEmail}
          headingNode={
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              {tEmail("heading")}
            </CardTitle>
          }
          descriptionNode={<CardDescription>{tEmail("description")}</CardDescription>}
          labels={{
            currentLabel: tEmail("currentLabel"),
            newLabel: tEmail("newLabel"),
            newPlaceholder: tEmail("newPlaceholder"),
            submit: tEmail("submit"),
            submitting: tEmail("submitting"),
            successToast: tEmail("successToast"),
          }}
          errorLabels={{
            invalid: tEmailErr("invalid"),
            same: tEmailErr("same"),
            taken: tEmailErr("taken"),
            rateLimited: tEmailErr("rateLimited"),
            sessionExpired: tEmailErr("sessionExpired"),
            failed: tEmailErr("failed"),
          }}
          onNotice={setNotice}
        />

        {/* セッション */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="h-4 w-4 text-destructive" aria-hidden />
              {tSession("heading")}
            </CardTitle>
            <CardDescription>{tSession("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={signingOut}
              onClick={async () => {
                if (signingOut) return
                setSigningOut(true)
                try {
                  const supabase = getSupabaseBrowserClient()
                  await supabase.auth.signOut()
                  router.replace("/fromhere")
                  router.refresh()
                } catch (error) {
                  setNotice(toErrorNotice(error, false))
                } finally {
                  setSigningOut(false)
                }
              }}
            >
              {signingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tSession("signingOut")}
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  {tSession("signOut")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* アカウント */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">{tDanger("heading")}</CardTitle>
            <CardDescription>{tDanger("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {tDanger("switchToGritvib")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

/** ----------------------------------------------------------
 *  パスワード変更セクション
 * ---------------------------------------------------------- */
type PasswordLabels = {
  newLabel: string
  newPlaceholder: string
  confirmLabel: string
  confirmPlaceholder: string
  submit: string
  submitting: string
  show: string
  hide: string
  successToast: string
}

type PasswordErrorLabels = {
  policy: string
  mismatch: string
  weak: string
  samePassword: string
  rateLimited: string
  sessionExpired: string
  failed: string
}

function PasswordSection({
  headingNode,
  descriptionNode,
  labels,
  errorLabels,
  onNotice,
}: {
  headingNode: React.ReactNode
  descriptionNode: React.ReactNode
  labels: PasswordLabels
  errorLabels: PasswordErrorLabels
  onNotice: (notice: AppNotice | null) => void
}) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const passwordValid = useMemo(() => isStrongPassword(password), [password])
  const matches = password.length > 0 && password === confirmPassword
  const canSubmit = !submitting && passwordValid && matches

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onNotice(null)
    if (!passwordValid) {
      onNotice({ variant: "error", message: errorLabels.policy })
      return
    }
    if (!matches) {
      onNotice({ variant: "error", message: errorLabels.mismatch })
      return
    }
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        onNotice({ variant: "error", message: humanizePasswordError(error, errorLabels) })
        return
      }
      onNotice(toSuccessNotice(labels.successToast))
      setPassword("")
      setConfirmPassword("")
      router.refresh()
    } catch (error) {
      onNotice(toErrorNotice(error, false, { unknownErrorMessage: errorLabels.failed }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        {headingNode}
        {descriptionNode}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_password">
              {labels.newLabel}
            </label>
            <div className="relative">
              <Input
                id="fh_settings_password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={labels.newPlaceholder}
                autoComplete="new-password"
                className="border-input bg-background pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? labels.hide : labels.show}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="fh_settings_password_confirm"
            >
              {labels.confirmLabel}
            </label>
            <div className="relative">
              <Input
                id="fh_settings_password_confirm"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={labels.confirmPlaceholder}
                autoComplete="new-password"
                className="border-input bg-background pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? labels.hide : labels.show}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !matches ? (
              <p className="text-xs text-red-500">{errorLabels.mismatch}</p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-11 bg-primary px-6 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {labels.submitting}
              </>
            ) : (
              labels.submit
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function isStrongPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN_LENGTH) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

function humanizePasswordError(
  error: { message?: string; status?: number; code?: string } | null | undefined,
  labels: PasswordErrorLabels,
): string {
  const message = (error?.message ?? "").toLowerCase()
  const status = error?.status
  if (status === 401 || status === 403 || message.includes("session")) {
    return labels.sessionExpired
  }
  if (status === 429 || message.includes("rate limit") || message.includes("too many")) {
    return labels.rateLimited
  }
  if (message.includes("same") || message.includes("must be different")) {
    return labels.samePassword
  }
  if (message.includes("weak") || message.includes("password should be")) {
    return labels.weak
  }
  if (message.includes("password")) {
    return labels.policy
  }
  return labels.failed
}

/** ----------------------------------------------------------
 *  メールアドレス変更セクション
 * ---------------------------------------------------------- */
type EmailLabels = {
  currentLabel: string
  newLabel: string
  newPlaceholder: string
  submit: string
  submitting: string
  successToast: string
}

type EmailErrorLabels = {
  invalid: string
  same: string
  taken: string
  rateLimited: string
  sessionExpired: string
  failed: string
}

function EmailSection({
  currentEmail,
  headingNode,
  descriptionNode,
  labels,
  errorLabels,
  onNotice,
}: {
  currentEmail: string
  headingNode: React.ReactNode
  descriptionNode: React.ReactNode
  labels: EmailLabels
  errorLabels: EmailErrorLabels
  onNotice: (notice: AppNotice | null) => void
}) {
  const [newEmail, setNewEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const normalized = newEmail.trim().toLowerCase()
  const isFormatValid = EMAIL_REGEX.test(normalized)
  const isSame = normalized === currentEmail.trim().toLowerCase()
  const canSubmit = !submitting && isFormatValid && !isSame

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onNotice(null)
    if (!isFormatValid) {
      onNotice({ variant: "error", message: errorLabels.invalid })
      return
    }
    if (isSame) {
      onNotice({ variant: "error", message: errorLabels.same })
      return
    }
    setSubmitting(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ email: normalized })
      if (error) {
        onNotice({ variant: "error", message: humanizeEmailError(error, errorLabels) })
        return
      }
      onNotice(toSuccessNotice(labels.successToast))
      setNewEmail("")
    } catch (error) {
      onNotice(toErrorNotice(error, false, { unknownErrorMessage: errorLabels.failed }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        {headingNode}
        {descriptionNode}
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_email_current">
              {labels.currentLabel}
            </label>
            <Input
              id="fh_settings_email_current"
              type="email"
              value={currentEmail}
              readOnly
              disabled
              className="border-input bg-muted/50 text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_email_new">
              {labels.newLabel}
            </label>
            <Input
              id="fh_settings_email_new"
              type="email"
              inputMode="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder={labels.newPlaceholder}
              autoComplete="email"
              className="border-input bg-background"
            />
            {newEmail.length > 0 && !isFormatValid ? (
              <p className="text-xs text-red-500">{errorLabels.invalid}</p>
            ) : null}
            {isSame && newEmail.length > 0 ? (
              <p className="text-xs text-muted-foreground">{errorLabels.same}</p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-11 bg-primary px-6 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {labels.submitting}
              </>
            ) : (
              labels.submit
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function humanizeEmailError(
  error: { message?: string; status?: number; code?: string } | null | undefined,
  labels: EmailErrorLabels,
): string {
  const message = (error?.message ?? "").toLowerCase()
  const status = error?.status
  if (status === 401 || status === 403 || message.includes("session")) {
    return labels.sessionExpired
  }
  if (status === 429 || message.includes("rate limit") || message.includes("too many")) {
    return labels.rateLimited
  }
  if (message.includes("already") || message.includes("taken") || message.includes("exists")) {
    return labels.taken
  }
  if (message.includes("same") || message.includes("must be different")) {
    return labels.same
  }
  if (message.includes("invalid") || message.includes("email")) {
    return labels.invalid
  }
  return labels.failed
}

/** ----------------------------------------------------------
 *  プロフィール編集セクション（画像 / 表示名 / 自己紹介）
 *
 *  - SSR 由来の `initial` を初期値として表示。
 *  - アバターは本体 `avatars` バケットへアップロードし、URL を
 *    `/api/fromhere/profile` PATCH の `avatarUrl` で `newvibes_profiles.avatar_url` に保存。
 *  - 保存後は `refreshProfile()` で AuthContext を最新化し、ヘッダー右にも即反映される。
 *  - ハンドルは「カスタムID」と同様、ここでは編集できない（初回設定済みのため）。
 * ---------------------------------------------------------- */
function ProfileSection({
  initial,
  onNotice,
}: {
  initial: SettingsInitialProfile
  onNotice: (notice: AppNotice | null) => void
}) {
  const router = useRouter()
  const t = useTranslations("fromhere.settings.profile")
  const tProfileEditErrors = useTranslations("fromhere.profileEdit.errors")
  const tAvatar = useTranslations("fromhere.profileEdit.avatar")
  const tAvatarErrors = useTranslations("fromhere.profileEdit.avatar.errors")
  const tHandle = useTranslations("fromhere.profileEdit.handle")

  const { user, refreshProfile } = useFromHereAuth()

  const [displayName, setDisplayName] = useState<string>(initial.displayName ?? "")
  const [bio, setBio] = useState<string>(initial.bio ?? "")
  const [submitting, setSubmitting] = useState(false)

  /**
   * アバターの変更状態:
   *   - `undefined`: 未変更（保存時にアバター項目は API へ送らない）
   *   - `null`: 削除（DB を NULL に）
   *   - `string`: 新規アップロード済みの公開 URL
   */
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null | undefined>(undefined)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  /**
   * クロップモーダル制御。本体共通の `ThumbnailCropModal` を使い、ユーザーが選択した
   * 元画像を 1:1 で切り抜いた JPEG を Storage へアップロードする。
   */
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl)
      }
    }
  }, [previewObjectUrl])

  const bioRemaining = useMemo(() => FROMHERE_BIO_MAX_LENGTH - bio.length, [bio])
  const displayNameRemaining = useMemo(
    () => FROMHERE_DISPLAY_NAME_MAX - displayName.trim().length,
    [displayName],
  )

  /**
   * ファイル選択直後は直接アップロードせず、クロップモーダルへ渡す。
   * 確定するまで Storage には書き込まないため、キャンセル時にゴミが残らない。
   */
  const onAvatarFileSelected = (file: File | null) => {
    if (!file || !user) {
      return
    }
    const fileCheck = validateFromHereAvatarFile(file)
    if (!fileCheck.ok) {
      onNotice({ variant: "error", message: localizedAvatarFileError(fileCheck.error, tAvatarErrors) })
      return
    }
    setCropSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(fileCheck.file)
    })
    setCropOpen(true)
  }

  const onCropClose = () => {
    setCropOpen(false)
    setCropSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const onCropConfirm = async (blob: Blob) => {
    if (!user) {
      return
    }
    setUploadingAvatar(true)
    try {
      const random =
        typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
          ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : Math.random().toString(36).slice(2, 14)
      const filename = `avatar-${random}.jpg`
      const storagePath = `${user.id}/${filename}`
      const file = new File([blob], filename, { type: "image/jpeg" })

      const supabase = getSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: "image/jpeg",
          upsert: false,
        })
      if (uploadError) {
        onNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(storagePath)
      if (!publicUrl) {
        onNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
        return
      }

      const objectUrl = URL.createObjectURL(file)
      setPreviewObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }
        return objectUrl
      })
      setPendingAvatarUrl(publicUrl)
    } catch {
      onNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onRemoveAvatar = () => {
    if (uploadingAvatar || submitting) {
      return
    }
    const confirmed = window.confirm(tAvatar("removeConfirm"))
    if (!confirmed) {
      return
    }
    setPreviewObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setPendingAvatarUrl(null)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || uploadingAvatar) {
      return
    }
    const validation = validateFromHereProfileEdit({ displayName, bio })
    if (!validation.ok) {
      onNotice({
        variant: "error",
        message: localizedClientError(validation.error, tProfileEditErrors),
      })
      return
    }

    const payload: {
      displayName: string
      bio: string
      avatarUrl?: string | null
    } = {
      displayName: validation.value.displayName,
      bio: validation.value.bio ?? "",
    }
    if (pendingAvatarUrl !== undefined) {
      payload.avatarUrl = pendingAvatarUrl
    }

    setSubmitting(true)
    try {
      const result = await updateFromHereProfileAction(payload)
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/profile update] action failed", { errorKey: result.error })
        }
        onNotice({
          variant: "error",
          message: mapProfileServerErrorToMessage(result.error, tProfileEditErrors),
        })
        return
      }
      await refreshProfile()
      onNotice(toSuccessNotice(t("successToast")))
      router.refresh()
    } catch (error) {
      onNotice(
        toErrorNotice(error, false, { unknownErrorMessage: tProfileEditErrors("saveFailed") }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * プレビュー表示する URL を決定する。
   * - 直前のローカルプレビュー > 「削除」中 (null) > 保留中の新規 URL > SSR 由来 URL の順。
   */
  const displayedAvatarUrl =
    previewObjectUrl ??
    (pendingAvatarUrl === null ? null : pendingAvatarUrl ?? initial.avatarUrl ?? null)
  const hasCurrentImage = Boolean(
    previewObjectUrl ||
      (pendingAvatarUrl !== null && (pendingAvatarUrl || initial.avatarUrl)),
  )

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle className="h-4 w-4 text-primary" aria-hidden />
          {t("heading")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ThumbnailCropModal
          open={cropOpen}
          imageSrc={cropSourceUrl}
          onClose={onCropClose}
          onConfirm={onCropConfirm}
          cropShape="avatar"
          outputPixelSize={{
            width: PROFILE_AVATAR_CROP_EXPORT_PX,
            height: PROFILE_AVATAR_CROP_EXPORT_PX,
          }}
        />
        <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
          <ProfileAvatarPicker
            label={tAvatar("label")}
            uploadAction={tAvatar("uploadAction")}
            changeAction={tAvatar("changeAction")}
            uploadingLabel={tAvatar("uploading")}
            removeAction={tAvatar("remove")}
            previewAlt={tAvatar("preview")}
            displayUrl={displayedAvatarUrl}
            fallbackSeed={initial.id}
            fallbackInitials={getInitials(displayName || initial.displayName || initial.handle)}
            uploading={uploadingAvatar}
            disabled={submitting}
            hasCurrentImage={hasCurrentImage}
            onFileSelected={(file) => void onAvatarFileSelected(file)}
            onRemove={onRemoveAvatar}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_handle">
              {t("handleLabel")}
            </label>
            <Input
              id="fh_settings_handle"
              type="text"
              value={`@${initial.handle}`}
              disabled
              className="h-10 cursor-not-allowed bg-muted/40 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">{tHandle("lockedNotice")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_display_name">
              {t("displayNameLabel")}
            </label>
            <Input
              id="fh_settings_display_name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={FROMHERE_DISPLAY_NAME_MAX + 10}
              required
              className="h-10"
              autoComplete="nickname"
            />
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <span className={displayNameRemaining < 0 ? "text-red-500" : ""}>
                {Math.max(0, displayName.trim().length)} / {FROMHERE_DISPLAY_NAME_MAX}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fh_settings_bio">
              {t("bioLabel")}
            </label>
            <textarea
              id="fh_settings_bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={FROMHERE_BIO_MAX_LENGTH + 30}
              rows={5}
              className="flex min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <span className={bioRemaining < 0 ? "text-red-500" : ""}>
                {bio.length} / {FROMHERE_BIO_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting || uploadingAvatar}
              className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <Link
              href={`/fromhere/u/${initial.handle}`}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {t("viewProfileLink")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/** ----------------------------------------------------------
 *  アバターピッカー（プロフィールセクション内で使用）
 * ---------------------------------------------------------- */
const FALLBACK_GRADIENTS = [
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-sky-500",
  "from-fuchsia-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-orange-500 to-red-500",
  "from-teal-500 to-cyan-500",
  "from-yellow-400 to-orange-500",
  "from-rose-500 to-violet-500",
] as const

function pickFallbackGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]!
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return "?"
  }
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
    }
  }
  return trimmed.slice(0, 1).toUpperCase()
}

type ProfileAvatarPickerProps = {
  label: string
  /** 補助テキスト。未指定 / 空文字なら何も描画しない */
  hint?: string
  uploadAction: string
  changeAction: string
  uploadingLabel: string
  removeAction: string
  previewAlt: string
  displayUrl: string | null
  fallbackSeed: string
  fallbackInitials: string
  uploading: boolean
  disabled: boolean
  hasCurrentImage: boolean
  onFileSelected: (file: File | null) => void
  onRemove: () => void
}

function ProfileAvatarPicker(props: ProfileAvatarPickerProps) {
  const gradient = pickFallbackGradient(props.fallbackSeed)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onClickPick = () => {
    if (props.uploading || props.disabled) {
      return
    }
    inputRef.current?.click()
  }

  const onChangeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    props.onFileSelected(file)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{props.label}</label>
      <div className="flex items-start gap-4">
        <div
          aria-label={props.previewAlt}
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-background sm:h-24 sm:w-24",
            props.displayUrl ? "bg-muted" : `bg-gradient-to-br ${gradient}`,
          )}
        >
          {props.displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 画像 / ObjectURL のプレビュー
            <img src={props.displayUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-white sm:text-3xl">
              {props.fallbackInitials}
            </span>
          )}
          {props.uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {props.hint ? (
            <p className="text-xs text-muted-foreground">{props.hint}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={props.uploading || props.disabled}
              onClick={onClickPick}
              className="gap-1.5"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              {props.uploading
                ? props.uploadingLabel
                : props.hasCurrentImage
                  ? props.changeAction
                  : props.uploadAction}
            </Button>
            {props.hasCurrentImage ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={props.uploading || props.disabled}
                onClick={props.onRemove}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {props.removeAction}
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onChangeFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}

/** プロフィール編集のクライアント検証エラーをローカライズ */
function localizedClientError(
  key: FromHereProfileEditErrorKey,
  tErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (key === "bioTooLong") {
    return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
  }
  return tErrors(key)
}

/** アバターファイルの検証エラーをローカライズ */
function localizedAvatarFileError(
  key: FromHereAvatarFileErrorKey,
  tAvatarErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (key) {
    case "tooLarge":
      return tAvatarErrors("tooLarge")
    case "invalidType":
      return tAvatarErrors("invalidType")
    case "noFile":
    default:
      return tAvatarErrors("uploadFailed")
  }
}

/** プロフィール API のサーバーエラーコードをローカライズ */
function mapProfileServerErrorToMessage(
  errorCode: string | undefined,
  tErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (errorCode) {
    case "displayNameRequired":
      return tErrors("displayNameRequired")
    case "displayNameTooLong":
      return tErrors("displayNameTooLong")
    case "bioTooLong":
      return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
    case "rate_limited":
      return tErrors("rateLimited")
    case "displayName":
      return tErrors("displayNameRequired")
    case "bio":
      return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
    case "avatarPath":
    case "avatarUrl":
      return tErrors("avatarPath")
    case "avatarOwner":
      return tErrors("avatarOwner")
    case "avatarMissing":
      return tErrors("avatarMissing")
    case "origin":
    case "internal":
    case "not_found":
    default:
      return tErrors("saveFailed")
  }
}
