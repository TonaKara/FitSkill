"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
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
import { normalizeProfileCategory } from "@/lib/profile-fields"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { getIsAdminFromProfile } from "@/lib/admin"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"

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
  const [fitnessHistory, setFitnessHistory] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )
  }

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
      .select("id, display_name, avatar_url, bio, fitness_history, category")
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

    setDisplayNameLabel(typeof nameVal === "string" ? nameVal.trim() : "")
    setStoredAvatarUrl(typeof avatarVal === "string" && avatarVal.trim().length > 0 ? avatarVal.trim() : null)
    setBio(typeof bioVal === "string" ? bioVal.trim() : "")
    setFitnessHistory(typeof fhVal === "string" ? fhVal.trim() : "")
    setSelectedCategories(
      normalizeProfileCategory(row?.category).filter((c) => c !== "フィットネス"),
    )
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

  const previewAvatarSrc = useMemo(() => {
    if (pendingAvatarPreview) {
      return pendingAvatarPreview
    }
    if (avatarMarkedForRemoval) {
      return resolveProfileAvatarUrl(null, displayNameLabel || "?")
    }
    return resolveProfileAvatarUrl(storedAvatarUrl, displayNameLabel || "?")
  }, [pendingAvatarPreview, avatarMarkedForRemoval, storedAvatarUrl, displayNameLabel])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }
    setNotice(null)
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
        fitness_history: fitnessHistory,
        category: selectedCategories,
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
          setNotice({ variant: "error", message: GENERIC_SAVE_FAILED })
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
            ? "プロフィールの内容は保存しました。アイコン画像は Storage の「avatars」バケットが未設定のためアップロードできませんでした。ダッシュボードでバケットとポリシーを確認してください。"
            : "プロフィールを保存しました。アイコン画像は保存できませんでした。しばらくしてから再度お試しください。",
        })
        await loadProfile()
        router.refresh()
        return
      }

      setNotice({ variant: "success", message: "プロフィールを保存しました。" })
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
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-16 pt-8 text-zinc-50">
      <ThumbnailCropModal
        open={cropModalOpen}
        imageSrc={cropSourceUrl}
        onClose={closeCropModal}
        onConfirm={handleCropConfirm}
        isAdmin={isAdmin}
        aspectRatio={1}
        heading="プロフィールアイコン"
        subheading="枠をドラッグして表示される範囲を調整できます（正方形でトリミングされます）。"
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">プロフィール設定</h1>
            <p className="mt-2 text-sm text-zinc-400">
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

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <p className="text-sm font-bold text-zinc-200">プロフィール画像</p>
            <p className="mt-1 text-xs text-zinc-500">
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
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                {previewAvatarSrc.startsWith("blob:") ? (
                  <Image
                    src={previewAvatarSrc}
                    alt="アイコンプレビュー"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase / ui-avatars の外部 URL
                  <img
                    src={previewAvatarSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                {(pendingAvatarPreview || (storedAvatarUrl && !avatarMarkedForRemoval)) ? (
                  <button
                    type="button"
                    onClick={clearAvatarSelection}
                    className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600/80 bg-black/70 text-zinc-100 transition-colors hover:border-red-500 hover:text-red-300"
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

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <label htmlFor="bio" className="text-sm font-bold text-zinc-200">
              自己紹介
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="自分の得意なことや経歴、克服したいことなど"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <label htmlFor="fitness_history" className="text-sm font-bold text-zinc-200">
              フィットネス歴
            </label>
            <textarea
              id="fitness_history"
              value={fitnessHistory}
              onChange={(e) => setFitnessHistory(e.target.value)}
              rows={4}
              placeholder="例：ジム歴3年、週末はランニングなど"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <p className="text-sm font-bold text-zinc-200">興味のある分野</p>
            <p className="mt-1 text-xs text-zinc-500">複数選択できます</p>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SKILL_CATEGORY_OPTIONS.map((category) => {
                const id = `cat-${category}`
                const checked = selectedCategories.includes(category)
                return (
                  <li key={category}>
                    <label
                      htmlFor={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked
                          ? "border-red-500/60 bg-red-950/30"
                          : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
                      }`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                        className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 focus:ring-offset-zinc-950"
                      />
                      <span className="text-sm text-zinc-200">{category}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
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
    </div>
  )
}
