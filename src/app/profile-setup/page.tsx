"use client"

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { ThumbnailCropModal } from "@/components/thumbnail-crop-modal"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  AVATARS_STORAGE_BUCKET,
  isStorageBucketNotFoundError,
  removeAvatarObjectAtPublicUrl,
} from "@/lib/avatar-storage"
import { ProfileAvatar } from "@/components/profile-avatar"
import { getProfileAvatarUrl, PROFILE_AVATAR_CROP_EXPORT_PX } from "@/lib/profile-avatar"
import { ProfileInterestCategoryPicker } from "@/components/profile-interest-category-picker"
import { loadProfileInterestCategories } from "@/lib/profile-interest-categories"
import { getIsAdminFromProfile } from "@/lib/admin"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import {
  isReservedCustomId,
  isValidCustomIdFormat,
  normalizeCustomId,
} from "@/lib/profile-path"
import {
  clearSignupPendingVerificationEmail,
  clearSignupVerificationResent,
  markPostEmailConfirmLoginHelpDone,
} from "@/lib/auth-email-flow"
import { getSiteUrl } from "@/lib/site-seo"

function revokeBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

const SAVE_SUCCESS_TOAST_MS = 1000
const GENERIC_SAVE_FAILED = "保存に失敗しました。時間を置いて再度お試しください。"

export default function ProfileSetupPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [displayNameLabel, setDisplayNameLabel] = useState("")
  const [storedAvatarUrl, setStoredAvatarUrl] = useState<string | null>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState("")
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false)

  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)

  const [bio, setBio] = useState("")
  /** UI 非表示。既存ユーザーの DB 値を保存時にそのまま維持する */
  const preservedFitnessHistoryRef = useRef<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [customId, setCustomId] = useState("")
  const [savedCustomId, setSavedCustomId] = useState("")
  const [showCustomIdConfirm, setShowCustomIdConfirm] = useState(false)
  const [pendingCustomIdForConfirm, setPendingCustomIdForConfirm] = useState("")
  const formRef = useRef<HTMLFormElement>(null)
  const customIdConfirmBypassRef = useRef(false)

  const siteBaseUrl = useMemo(() => getSiteUrl(), [])

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
      clearSignupPendingVerificationEmail()
      clearSignupVerificationResent()
      setUserId(data.user.id)
      setIsAdmin(await getIsAdminFromProfile(supabase, data.user.id))
      setAuthLoading(false)
    }

    void checkAuth()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return
    }
    setProfileLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio, fitness_history, category, custom_id")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "プロフィールの読み込みに失敗しました。" }),
      )
      setProfileLoading(false)
      return
    }

    const row = data as Record<string, unknown> | null
    const bioVal = row?.bio
    const fhVal = row?.fitness_history
    const nameVal = row?.display_name
    const avatarVal = row?.avatar_url
    const customIdVal = row?.custom_id
    const customIdStr = typeof customIdVal === "string" ? customIdVal.trim() : ""

    setDisplayNameLabel(typeof nameVal === "string" ? nameVal.trim() : "")
    setStoredAvatarUrl(typeof avatarVal === "string" && avatarVal.trim().length > 0 ? avatarVal.trim() : null)
    setBio(typeof bioVal === "string" ? bioVal.trim() : "")
    preservedFitnessHistoryRef.current =
      typeof fhVal === "string" && fhVal.trim().length > 0 ? fhVal.trim() : null
    setSelectedCategories(loadProfileInterestCategories(row?.category))
    setCustomId(customIdStr)
    setSavedCustomId(customIdStr)
    setPendingAvatarFile(null)
    setAvatarMarkedForRemoval(false)
    setPendingAvatarPreview((prev) => {
      if (prev) revokeBlobUrl(prev)
      return ""
    })
    setProfileLoading(false)
  }, [supabase, userId, isAdmin])

  useEffect(() => {
    if (userId) {
      void loadProfile()
    }
  }, [userId, loadProfile])

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) {
        revokeBlobUrl(pendingAvatarPreview)
      }
    }
  }, [pendingAvatarPreview])

  const closeCropModal = () => {
    setCropModalOpen(false)
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
      setCropSourceUrl(null)
    }
  }

  const handleCropConfirm = async (blob: Blob) => {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" })
    setPendingAvatarFile(file)
    setAvatarMarkedForRemoval(false)
    setPendingAvatarPreview((prev) => {
      if (prev) revokeBlobUrl(prev)
      return URL.createObjectURL(blob)
    })
  }

  const handleAvatarFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setNotice(null)
    if (!file) {
      event.target.value = ""
      return
    }
    if (!file.type.startsWith("image/")) {
      setNotice({ variant: "error", message: "画像ファイル（jpg/png/webp等）を選択してください。" })
      event.target.value = ""
      return
    }
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
    }
    setCropSourceUrl(URL.createObjectURL(file))
    setCropModalOpen(true)
    event.target.value = ""
  }

  const clearAvatarSelection = () => {
    if (pendingAvatarFile || pendingAvatarPreview) {
      setPendingAvatarFile(null)
      setPendingAvatarPreview((prev) => {
        if (prev) revokeBlobUrl(prev)
        return ""
      })
      setAvatarMarkedForRemoval(false)
      return
    }
    if (storedAvatarUrl) {
      setAvatarMarkedForRemoval(true)
    }
  }

  const uploadAvatarToStorage = async (currentUserId: string, file: File): Promise<string> => {
    const extension =
      file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg")
        ? "jpg"
        : (file.name.split(".").pop()?.toLowerCase() ?? "jpg")
    const allowed = ["jpg", "jpeg", "png", "webp", "gif"]
    const ext = allowed.includes(extension) ? extension : "jpg"
    const objectKey = `${currentUserId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(AVATARS_STORAGE_BUCKET).upload(objectKey, file, {
      upsert: false,
      contentType: file.type || `image/${ext === "jpg" || ext === "jpeg" ? "jpeg" : ext}`,
    })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(objectKey)

    if (!publicUrl) {
      throw new Error("アイコン画像の公開URL取得に失敗しました。")
    }

    return publicUrl
  }

  const customIdLocked = savedCustomId.trim().length > 0

  const handleCustomIdConfirmCancel = useCallback(() => {
    if (saving) {
      return
    }
    customIdConfirmBypassRef.current = false
    setShowCustomIdConfirm(false)
    setPendingCustomIdForConfirm("")
  }, [saving])

  const handleCustomIdConfirmProceed = useCallback(() => {
    customIdConfirmBypassRef.current = true
    setShowCustomIdConfirm(false)
    setPendingCustomIdForConfirm("")
    formRef.current?.requestSubmit()
  }, [])

  const previewAvatarUrl = useMemo(() => {
    if (pendingAvatarPreview) {
      return pendingAvatarPreview
    }
    if (avatarMarkedForRemoval) {
      return null
    }
    return getProfileAvatarUrl(storedAvatarUrl)
  }, [pendingAvatarPreview, avatarMarkedForRemoval, storedAvatarUrl])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }
    setNotice(null)

    const normalizedCustomId = normalizeCustomId(customId)
    const normalizedSavedCustomId = normalizeCustomId(savedCustomId)
    if (
      !customIdConfirmBypassRef.current &&
      normalizedSavedCustomId.length === 0 &&
      normalizedCustomId.length > 0
    ) {
      setPendingCustomIdForConfirm(normalizedCustomId)
      setShowCustomIdConfirm(true)
      return
    }
    customIdConfirmBypassRef.current = false

    if (normalizedSavedCustomId.length > 0 && normalizedCustomId !== normalizedSavedCustomId) {
      setNotice({
        variant: "error",
        message: "カスタムIDは一度設定すると変更できません。",
      })
      return
    }
    if (normalizedCustomId.length > 0) {
      if (!isValidCustomIdFormat(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message:
            "カスタムIDは英小文字で開始し、3〜30文字の英小文字・数字・_・-のみ使用できます。",
        })
        return
      }
      if (isReservedCustomId(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message: "そのカスタムIDは予約語のため利用できません。",
        })
        return
      }
    }

    setSaving(true)

    let uploadedNewUrl: string | null = null
    let avatarSkippedDueToMissingBucket = false

    try {
      if (pendingAvatarFile) {
        try {
          uploadedNewUrl = await uploadAvatarToStorage(userId, pendingAvatarFile)
        } catch (uploadErr) {
          if (isStorageBucketNotFoundError(uploadErr)) {
            avatarSkippedDueToMissingBucket = true
            uploadedNewUrl = null
          } else {
            throw uploadErr
          }
        }
      }

      const payload: Record<string, unknown> = {
        bio,
        fitness_history: preservedFitnessHistoryRef.current,
        category: selectedCategories,
        custom_id: normalizedCustomId,
      }

      if (pendingAvatarFile && uploadedNewUrl) {
        payload.avatar_url = uploadedNewUrl
      } else if (avatarMarkedForRemoval && storedAvatarUrl) {
        payload.avatar_url = null
      } else if (avatarMarkedForRemoval && !storedAvatarUrl && !pendingAvatarFile) {
        // そもそも保存済み画像がない場合は API に avatar を送らない
      }

      const response = await fetch("/api/profile/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responseText = await response.text()
      let responsePayload: {
        error?: string
        code?: string
        details?: string
        hint?: string
      } = {}
      try {
        responsePayload = responseText ? (JSON.parse(responseText) as typeof responsePayload) : {}
      } catch {
        responsePayload = { error: responseText.trim().slice(0, 800) || undefined }
      }

      if (!response.ok) {
        if (uploadedNewUrl) {
          await removeAvatarObjectAtPublicUrl(supabase, userId, uploadedNewUrl)
        }
        if (isAdmin) {
          const parts = [
            `HTTP ${response.status}`,
            responsePayload.error,
            responsePayload.details,
            responsePayload.hint,
            responsePayload.code,
          ].filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          setNotice({
            variant: "error",
            message: parts.length > 0 ? parts.join(" — ") : GENERIC_SAVE_FAILED,
          })
        } else {
          const rawErr =
            typeof responsePayload.error === "string" && responsePayload.error.trim().length > 0
              ? responsePayload.error.trim()
              : ""
          const allowedUserMessages = new Set([
            GENERIC_SAVE_FAILED,
            "保存に失敗しました。",
            "このカスタムIDは既に使用されています。",
          ])
          const apiMsg = rawErr && allowedUserMessages.has(rawErr) ? rawErr : GENERIC_SAVE_FAILED
          setNotice({ variant: "error", message: apiMsg })
        }
        return
      }

      const previousStored = storedAvatarUrl
      const replacedAvatar = Boolean(pendingAvatarFile && uploadedNewUrl)
      const clearedAvatar = Boolean(avatarMarkedForRemoval && storedAvatarUrl)
      if (previousStored && (replacedAvatar || clearedAvatar)) {
        await removeAvatarObjectAtPublicUrl(supabase, userId, previousStored)
      }

      if (avatarSkippedDueToMissingBucket) {
        setNotice({
          variant: "success",
          message: isAdmin
            ? "プロフィールの内容は保存しました。アイコン画像はサービス上の準備が整うまでアップロードできませんでした。"
            : "プロフィールを保存しました。アイコン画像は保存できませんでした。しばらくしてから再度お試しください。",
        })
        await loadProfile()
        router.refresh()
        markPostEmailConfirmLoginHelpDone()
        return
      }

      setNotice({ variant: "success", message: "プロフィールを保存しました。" })
      markPostEmailConfirmLoginHelpDone()
      window.setTimeout(() => {
        router.push("/")
        router.refresh()
      }, SAVE_SUCCESS_TOAST_MS)
    } catch (fetchError) {
      if (uploadedNewUrl) {
        await removeAvatarObjectAtPublicUrl(supabase, userId, uploadedNewUrl)
      }
      if (isAdmin) {
        const msg = fetchError instanceof Error ? fetchError.message : String(fetchError)
        setNotice({ variant: "error", message: `保存に失敗しました: ${msg}` })
      } else {
        setNotice({ variant: "error", message: GENERIC_SAVE_FAILED })
      }
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || (userId && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden />
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-16 pt-8 text-foreground">
      <ThumbnailCropModal
        open={cropModalOpen}
        imageSrc={cropSourceUrl}
        onClose={closeCropModal}
        onConfirm={handleCropConfirm}
        isAdmin={isAdmin}
        cropShape="avatar"
        outputPixelSize={{ width: PROFILE_AVATAR_CROP_EXPORT_PX, height: PROFILE_AVATAR_CROP_EXPORT_PX }}
        heading="プロフィールアイコン"
        subheading="枠内が保存される範囲です。ドラッグで位置を、ホイールやピンチで拡大・縮小できます。"
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">プロフィール設定</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              アイコン・自己紹介や興味のある分野を登録して、GritVib を始めましょう！
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-red-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
          >
            スキップしてホームへ
          </Link>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <p className="text-sm font-bold text-foreground">プロフィール画像</p>
            <p className="mt-1 text-xs text-muted-foreground">
              プロフィールやチャットなどで表示されるアイコン画像を設定できます（任意）
            </p>
            <Input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarFileSelect}
            />
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="relative h-28 w-28 shrink-0">
                <ProfileAvatar
                  src={previewAvatarUrl}
                  alt="アイコンプレビュー"
                  className="h-28 w-28 border border-border"
                  sizes="112px"
                />
                {(pendingAvatarPreview || (storedAvatarUrl && !avatarMarkedForRemoval)) ? (
                  <button
                    type="button"
                    onClick={clearAvatarSelection}
                    className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:border-red-500 hover:text-red-300"
                    aria-label="プロフィール画像を削除"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 w-full border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500 sm:w-auto sm:self-start"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  画像を選択
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <label htmlFor="profile-setup-custom-id" className="text-sm font-bold text-foreground">
              カスタムID（任意・設定推奨）
            </label>
            <Input
              id="profile-setup-custom-id"
              value={customId}
              onChange={(e) => setCustomId(normalizeCustomId(e.target.value))}
              placeholder="例: taro_fit"
              className={`mt-2 border-input placeholder:text-muted-foreground ${
                customIdLocked
                  ? "cursor-not-allowed bg-muted text-muted-foreground opacity-100"
                  : "bg-background text-foreground focus-visible:ring-primary"
              }`}
              aria-describedby="profile-setup-custom-id-hint"
              disabled={customIdLocked}
            />
            <p id="profile-setup-custom-id-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
              ストアURLを見やすくできます（例: 『taro_fit』とした場合、
              {`${siteBaseUrl}/store/taro_fit`} のように表示されます）。英小文字で開始し、3〜30文字の英小文字・数字・アンダーバー・ハイフンが使えます。
              一度設定したカスタムIDは変更できませんのでご注意ください。
            </p>
            {customIdLocked ? (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                設定済みのため、カスタムIDは編集できません。
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <label htmlFor="bio" className="text-sm font-bold text-foreground">
              自己紹介
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="自分の得意なことや経歴、克服したいことなど"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-950/80">
            <p className="text-sm font-bold text-foreground">興味のある分野</p>
            <p className="mt-1 text-xs text-muted-foreground">複数選択できます</p>
            <div className="mt-4">
              <ProfileInterestCategoryPicker
                selectedCategories={selectedCategories}
                onChange={setSelectedCategories}
                idPrefix="setup-cat"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                保存中...
              </>
            ) : (
              "保存する"
            )}
          </Button>
        </form>
      </div>

      {typeof document !== "undefined" &&
        showCustomIdConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-6"
            role="presentation"
            onClick={handleCustomIdConfirmCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-setup-custom-id-confirm-title"
              className="my-auto w-full min-w-0 max-w-md shrink-0 overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="profile-setup-custom-id-confirm-title"
                className="text-base font-semibold leading-relaxed text-foreground"
              >
                カスタムID設定の確認
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                このIDで設定すると、ストアURLは以下になります。
              </p>
              <div className="mt-3 min-w-0 w-full overflow-hidden rounded-lg border border-red-500/35 bg-muted px-3 py-2">
                <p className="font-mono text-xs leading-relaxed break-all text-red-700 dark:text-red-200 [overflow-wrap:anywhere] sm:text-sm">
                  {siteBaseUrl}/store/{pendingCustomIdForConfirm}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                カスタムIDは一度設定すると変更できません。この内容で保存しますか？
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border bg-muted text-foreground hover:bg-muted/80"
                  onClick={handleCustomIdConfirmCancel}
                  disabled={saving}
                >
                  戻る
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-500"
                  onClick={handleCustomIdConfirmProceed}
                  disabled={saving}
                >
                  このIDで保存する
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
