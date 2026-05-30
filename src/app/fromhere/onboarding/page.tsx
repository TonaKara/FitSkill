"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AtSign, CheckCircle2, ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { AVATARS_STORAGE_BUCKET } from "@/lib/avatar-storage"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import {
  checkFromHereHandleAvailabilityAction,
  createFromHereProfileAction,
} from "@/fromhere/_profile-actions"
import {
  FROMHERE_BIO_MAX_LENGTH,
  normalizeFromHereHandle,
  validateFromHereDisplayName,
  validateFromHereHandle,
} from "@/fromhere/_handle-validation"
import {
  inferFromHereAvatarExtension,
  validateFromHereAvatarFile,
  type FromHereAvatarFileErrorKey,
} from "@/fromhere/_avatar-validation"

type HandleStatus =
  | { state: "idle" }
  | { state: "format" | "reserved" | "taken" | "available"; handle: string }
  | { state: "checking" }
  | { state: "error" }

/** メール確認後の onboarding ページ。
 *
 * - 未認証ならサインインへリダイレクト。
 * - 既にプロフィールがある場合は /fromhere へ。
 * - フォーム送信で `/api/fromhere/profile` を呼び、サーバー側で `newvibes_profiles` を INSERT する。
 *   成功後 `refreshProfile()` でコンテキストを更新し、`/fromhere` へ遷移する。
 */
export default function FromHereOnboardingPage() {
  const router = useRouter()
  const t = useTranslations("fromhere.onboarding")
  const tToast = useTranslations("fromhere.auth.toasts")

  const { user, profile, loading: authLoading, refreshProfile } = useFromHereAuth()

  const [handleInput, setHandleInput] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ state: "idle" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  /**
   * アバター画像（任意）。
   * - `null`: 未設定（OK、画像なしで onboarding 可能）
   * - `string`: アップロード済み公開 URL（本体 `avatars` バケット由来）
   */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const redirectedRef = useRef(false)
  const checkTimerRef = useRef<number | null>(null)

  /** unmount / 差し替え時に Object URL を解放 */
  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl)
      }
    }
  }, [previewObjectUrl])

  const normalizedHandle = useMemo(() => normalizeFromHereHandle(handleInput), [handleInput])
  const localValidation = useMemo(() => validateFromHereHandle(handleInput), [handleInput])

  /** 未認証・プロフィール既存時のリダイレクト */
  useEffect(() => {
    if (authLoading || redirectedRef.current) {
      return
    }
    if (!user) {
      redirectedRef.current = true
      router.replace("/fromhere/signin")
      return
    }
    if (profile) {
      redirectedRef.current = true
      router.replace("/fromhere")
    }
  }, [authLoading, user, profile, router])

  /**
   * signUp 時のメタデータからの初期値補完（display_name が user_metadata にあれば）。
   * - user は非同期で読み込まれるため effect で setState する必要がある。
   * - 1 回きりの初期値補完なので、cascading render の懸念は無い。
   */
  useEffect(() => {
    if (!user) {
      return
    }
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const dn = typeof metadata.display_name === "string" ? metadata.display_name.trim() : ""
    if (dn && !displayName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部値(user_metadata)からの初期同期
      setDisplayName(dn)
    }
  }, [user, displayName])

  /** ハンドル可用性のリモートチェック（debounce） */
  const scheduleAvailabilityCheck = useCallback(
    (raw: string) => {
      if (checkTimerRef.current) {
        window.clearTimeout(checkTimerRef.current)
        checkTimerRef.current = null
      }
      const validation = validateFromHereHandle(raw)
      if (!validation.ok) {
        setHandleStatus({ state: validation.error, handle: validation.handle })
        return
      }
      setHandleStatus({ state: "checking" })
      const target = validation.handle
      checkTimerRef.current = window.setTimeout(async () => {
        try {
          const result = await checkFromHereHandleAvailabilityAction({ handle: target })
          const normalized = result.normalized ?? target
          if (result.available) {
            setHandleStatus({ state: "available", handle: normalized })
          } else if (result.reason === "reserved") {
            setHandleStatus({ state: "reserved", handle: normalized })
          } else if (result.reason === "taken") {
            setHandleStatus({ state: "taken", handle: normalized })
          } else if (result.reason === "format") {
            setHandleStatus({ state: "format", handle: normalized })
          } else {
            setHandleStatus({ state: "error" })
          }
        } catch {
          setHandleStatus({ state: "error" })
        }
      }, 350)
    },
    [],
  )

  useEffect(() => {
    if (!handleInput.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 入力が空になったら idle にリセットする外部同期
      setHandleStatus({ state: "idle" })
      return
    }
    scheduleAvailabilityCheck(handleInput)
    return () => {
      if (checkTimerRef.current) {
        window.clearTimeout(checkTimerRef.current)
        checkTimerRef.current = null
      }
    }
  }, [handleInput, scheduleAvailabilityCheck])

  const canSubmit =
    !isSubmitting &&
    !uploadingAvatar &&
    handleStatus.state === "available" &&
    localValidation.ok &&
    validateFromHereDisplayName(displayName) &&
    bio.trim().length <= FROMHERE_BIO_MAX_LENGTH

  /**
   * アバター画像をアップロード。
   * - 本体共通の `avatars` バケットに `<uid>/<filename>` で保存。
   * - 成功すれば公開 URL を state に保持し、onboarding 完了時に POST body に乗せる。
   * - 失敗してもフォームは続行可能（画像は任意項目）。
   */
  const onAvatarFileSelected = async (file: File | null) => {
    if (!file || !user) {
      return
    }
    const fileCheck = validateFromHereAvatarFile(file)
    if (!fileCheck.ok) {
      setNotice({
        variant: "error",
        message: avatarFileErrorMessage(fileCheck.error, t),
      })
      return
    }
    setUploadingAvatar(true)
    try {
      const ext = inferFromHereAvatarExtension(fileCheck.file)
      const random =
        typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
          ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : Math.random().toString(36).slice(2, 14)
      const filename = `avatar-${random}.${ext}`
      const storagePath = `${user.id}/${filename}`

      const supabase = getSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_STORAGE_BUCKET)
        .upload(storagePath, fileCheck.file, {
          contentType: fileCheck.file.type,
          upsert: false,
        })
      if (uploadError) {
        setNotice({ variant: "error", message: t("avatarUploadFailed") })
        return
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(storagePath)
      if (!publicUrl) {
        setNotice({ variant: "error", message: t("avatarUploadFailed") })
        return
      }
      const objectUrl = URL.createObjectURL(fileCheck.file)
      setPreviewObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }
        return objectUrl
      })
      setAvatarUrl(publicUrl)
    } catch {
      setNotice({ variant: "error", message: t("avatarUploadFailed") })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onClearAvatar = () => {
    if (uploadingAvatar || isSubmitting) {
      return
    }
    setPreviewObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setAvatarUrl(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    if (!canSubmit) {
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createFromHereProfileAction({
        handle: normalizedHandle,
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
      })

      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/profile create] action failed", { errorKey: result.error })
        }
        if (result.error === "unauthorized") {
          setNotice({ variant: "error", message: tToast("sessionExpired") })
          router.replace("/fromhere/signin")
          return
        }
        if (result.error === "taken") {
          setHandleStatus({ state: "taken", handle: normalizedHandle })
          setNotice({ variant: "error", message: t("handleTakenError") })
          return
        }
        if (result.error === "reserved") {
          setHandleStatus({ state: "reserved", handle: normalizedHandle })
          setNotice({ variant: "error", message: t("handleReservedError") })
          return
        }
        if (result.error === "format") {
          setHandleStatus({ state: "format", handle: normalizedHandle })
          setNotice({ variant: "error", message: t("handleFormatError") })
          return
        }
        if (result.error === "displayName") {
          setNotice({ variant: "error", message: t("displayNameRequired") })
          return
        }
        if (result.error === "conflict") {
          await refreshProfile()
          router.replace("/fromhere")
          return
        }
        setNotice({ variant: "error", message: t("errorToast") })
        return
      }

      setNotice(toSuccessNotice(t("successToast")))
      await refreshProfile()
      redirectedRef.current = true
      router.replace("/fromhere")
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-20 text-sm text-muted-foreground">
        <Loader2 className="mb-3 h-5 w-5 animate-spin" />
        {authLoading ? t("checking") : t("redirecting")}
      </div>
    )
  }

  const handleHelperText = (() => {
    switch (handleStatus.state) {
      case "available":
        return { tone: "success" as const, text: t("handleAvailable") }
      case "format":
        return { tone: "error" as const, text: t("handleFormatError") }
      case "reserved":
        return { tone: "error" as const, text: t("handleReservedError") }
      case "taken":
        return { tone: "error" as const, text: t("handleTakenError") }
      case "checking":
        return { tone: "muted" as const, text: t("handleChecking") }
      default:
        return null
    }
  })()

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 md:py-16">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <Card className="border-border bg-card shadow-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-bold text-foreground">{t("title")}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ----- アバター画像（任意） ----- */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("avatarLabel")}
              </label>
              <div className="flex items-start gap-4">
                <div
                  aria-label={t("avatarPreviewAlt")}
                  className={cn(
                    "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-background",
                    previewObjectUrl ? "bg-muted" : "bg-gradient-to-br from-amber-400 to-rose-500",
                  )}
                >
                  {previewObjectUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- onboarding 中のローカルプレビュー
                    <img
                      src={previewObjectUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {(displayName.trim() || handleInput.trim() || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {uploadingAvatar ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">{t("avatarHelp")}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingAvatar || isSubmitting}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5"
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden />
                      {uploadingAvatar
                        ? t("avatarUploading")
                        : previewObjectUrl
                          ? t("avatarChange")
                          : t("avatarUpload")}
                    </Button>
                    {previewObjectUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={uploadingAvatar || isSubmitting}
                        onClick={onClearAvatar}
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {t("avatarRemove")}
                      </Button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      event.target.value = ""
                      void onAvatarFileSelected(file)
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_handle">
                {t("handleLabel")}
              </label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fromhere_handle"
                  value={handleInput}
                  onChange={(event) => setHandleInput(event.target.value)}
                  placeholder={t("handlePlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="email"
                  maxLength={32}
                  className="border-input bg-background pl-9 text-foreground placeholder:text-muted-foreground"
                />
                {handleStatus.state === "checking" ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : handleStatus.state === "available" ? (
                  <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                ) : null}
              </div>
              {handleHelperText ? (
                <p
                  className={cn(
                    "text-xs",
                    handleHelperText.tone === "success" && "text-emerald-500",
                    handleHelperText.tone === "error" && "text-red-500",
                    handleHelperText.tone === "muted" && "text-muted-foreground",
                  )}
                >
                  {handleHelperText.text}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">{t("handleHelp")}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_display_name">
                {t("displayNameLabel")}
              </label>
              <Input
                id="fromhere_display_name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("displayNamePlaceholder")}
                autoComplete="nickname"
                maxLength={50}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">{t("displayNameHelp")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fromhere_bio">
                {t("bioLabel")}
              </label>
              <textarea
                id="fromhere_bio"
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, FROMHERE_BIO_MAX_LENGTH))}
                placeholder={t("bioPlaceholder")}
                maxLength={FROMHERE_BIO_MAX_LENGTH}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("bioHelp")}</span>
                <span>
                  {bio.length} / {FROMHERE_BIO_MAX_LENGTH}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
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

      <div className="text-center text-sm text-muted-foreground">
        <Link href="/fromhere" className="underline-offset-4 hover:underline">
          ← FromHere
        </Link>
      </div>
    </div>
  )
}

/** クライアント側のファイル検証エラーをローカライズ */
function avatarFileErrorMessage(
  key: FromHereAvatarFileErrorKey,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (key) {
    case "tooLarge":
      return t("avatarTooLarge")
    case "invalidType":
      return t("avatarInvalidType")
    case "noFile":
    default:
      return t("avatarUploadFailed")
  }
}
