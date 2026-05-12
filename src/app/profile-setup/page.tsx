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
import {
  isReservedCustomId,
  isValidCustomIdFormat,
  normalizeCustomId,
} from "@/lib/profile-path"
import { clearSignupPendingVerificationEmail, clearSignupVerificationResent } from "@/lib/auth-email-flow"
import { getSiteUrl } from "@/lib/site-seo"

function revokeBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

const SAVE_SUCCESS_TOAST_MS = 1000
const GENERIC_SAVE_FAILED = "菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆縲よ凾髢薙ｒ鄂ｮ縺・※蜀榊ｺｦ縺願ｩｦ縺励￥縺縺輔＞縲・

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
  const [customId, setCustomId] = useState("")
  const [savedCustomId, setSavedCustomId] = useState("")
  const [showCustomIdConfirm, setShowCustomIdConfirm] = useState(false)
  const [pendingCustomIdForConfirm, setPendingCustomIdForConfirm] = useState("")
  const formRef = useRef<HTMLFormElement>(null)
  const customIdConfirmBypassRef = useRef(false)

  const siteBaseUrl = useMemo(() => getSiteUrl(), [])

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
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "繝励Ο繝輔ぅ繝ｼ繝ｫ縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・ }),
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
    setFitnessHistory(typeof fhVal === "string" ? fhVal.trim() : "")
    setSelectedCategories(
      normalizeProfileCategory(row?.category).filter((c) => c !== "繝輔ぅ繝・ヨ繝阪せ"),
    )
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
      setNotice({ variant: "error", message: "逕ｻ蜒上ヵ繧｡繧､繝ｫ・・pg/png/webp遲会ｼ峨ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・ })
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
      throw new Error("繧｢繧､繧ｳ繝ｳ逕ｻ蜒上・蜈ｬ髢偽RL蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・)
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
        message: "繧ｫ繧ｹ繧ｿ繝ID縺ｯ荳蠎ｦ險ｭ螳壹☆繧九→螟画峩縺ｧ縺阪∪縺帙ｓ縲・,
      })
      return
    }
    if (normalizedCustomId.length > 0) {
      if (!isValidCustomIdFormat(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message:
            "繧ｫ繧ｹ繧ｿ繝ID縺ｯ闍ｱ蟆乗枚蟄励〒髢句ｧ九＠縲・縲・0譁・ｭ励・闍ｱ蟆乗枚蟄励・謨ｰ蟄励・_繝ｻ-縺ｮ縺ｿ菴ｿ逕ｨ縺ｧ縺阪∪縺吶・,
        })
        return
      }
      if (isReservedCustomId(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message: "縺昴・繧ｫ繧ｹ繧ｿ繝ID縺ｯ莠育ｴ・ｪ槭・縺溘ａ蛻ｩ逕ｨ縺ｧ縺阪∪縺帙ｓ縲・,
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
        fitness_history: fitnessHistory,
        category: selectedCategories,
        custom_id: normalizedCustomId,
      }

      if (pendingAvatarFile && uploadedNewUrl) {
        payload.avatar_url = uploadedNewUrl
      } else if (avatarMarkedForRemoval && storedAvatarUrl) {
        payload.avatar_url = null
      } else if (avatarMarkedForRemoval && !storedAvatarUrl && !pendingAvatarFile) {
        // 縺昴ｂ縺昴ｂ菫晏ｭ俶ｸ医∩逕ｻ蜒上′縺ｪ縺・ｴ蜷医・ API 縺ｫ avatar 繧帝√ｉ縺ｪ縺・      }

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
            message: parts.length > 0 ? parts.join(" 窶・") : GENERIC_SAVE_FAILED,
          })
        } else {
          const rawErr =
            typeof responsePayload.error === "string" && responsePayload.error.trim().length > 0
              ? responsePayload.error.trim()
              : ""
          const allowedUserMessages = new Set([
            GENERIC_SAVE_FAILED,
            "菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆縲・,
            "縺薙・繧ｫ繧ｹ繧ｿ繝ID縺ｯ譌｢縺ｫ菴ｿ逕ｨ縺輔ｌ縺ｦ縺・∪縺吶・,
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
            ? "繝励Ο繝輔ぅ繝ｼ繝ｫ縺ｮ蜀・ｮｹ縺ｯ菫晏ｭ倥＠縺ｾ縺励◆縲ゅい繧､繧ｳ繝ｳ逕ｻ蜒上・ Storage 縺ｮ縲径vatars縲阪ヰ繧ｱ繝・ヨ縺梧悴險ｭ螳壹・縺溘ａ繧｢繝・・繝ｭ繝ｼ繝峨〒縺阪∪縺帙ｓ縺ｧ縺励◆縲ゅム繝・す繝･繝懊・繝峨〒繝舌こ繝・ヨ縺ｨ繝昴Μ繧ｷ繝ｼ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・
            : "繝励Ο繝輔ぅ繝ｼ繝ｫ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆縲ゅい繧､繧ｳ繝ｳ逕ｻ蜒上・菫晏ｭ倥〒縺阪∪縺帙ｓ縺ｧ縺励◆縲ゅ＠縺ｰ繧峨￥縺励※縺九ｉ蜀榊ｺｦ縺願ｩｦ縺励￥縺縺輔＞縲・,
        })
        await loadProfile()
        router.refresh()
        return
      }

      setNotice({ variant: "success", message: "繝励Ο繝輔ぅ繝ｼ繝ｫ繧剃ｿ晏ｭ倥＠縺ｾ縺励◆縲・ })
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
        setNotice({ variant: "error", message: `菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆: ${msg}` })
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
        隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...
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
        heading="繝励Ο繝輔ぅ繝ｼ繝ｫ繧｢繧､繧ｳ繝ｳ"
        subheading="譫蜀・′菫晏ｭ倥＆繧後ｋ遽・峇縺ｧ縺吶ゅラ繝ｩ繝・げ縺ｧ菴咲ｽｮ繧偵√・繧､繝ｼ繝ｫ繧・ヴ繝ｳ繝√〒諡｡螟ｧ繝ｻ邵ｮ蟆上〒縺阪∪縺呻ｼ域ｭ｣譁ｹ蠖｢縺ｧ繝医Μ繝溘Φ繧ｰ縺輔ｌ縺ｾ縺呻ｼ峨・
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">繝励Ο繝輔ぅ繝ｼ繝ｫ險ｭ螳・/h1>
            <p className="mt-2 text-sm text-zinc-400">
              繧｢繧､繧ｳ繝ｳ繝ｻ閾ｪ蟾ｱ邏ｹ莉九ｄ闊亥袖縺ｮ縺ゅｋ蛻・㍽繧堤匳骭ｲ縺励※縲；ritVib 繧貞ｧ九ａ縺ｾ縺励ｇ縺・ｼ・            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-red-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
          >
            繧ｹ繧ｭ繝・・縺励※繝帙・繝縺ｸ
          </Link>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
            <p className="text-sm font-bold text-zinc-200">繝励Ο繝輔ぅ繝ｼ繝ｫ逕ｻ蜒・/p>
            <p className="mt-1 text-xs text-zinc-500">
              繝励Ο繝輔ぅ繝ｼ繝ｫ繧・メ繝｣繝・ヨ縺ｪ縺ｩ縺ｧ陦ｨ遉ｺ縺輔ｌ繧九い繧､繧ｳ繝ｳ逕ｻ蜒上ｒ險ｭ螳壹〒縺阪∪縺呻ｼ井ｻｻ諢擾ｼ・            </p>
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
                    alt="繧｢繧､繧ｳ繝ｳ繝励Ξ繝薙Η繝ｼ"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase / ui-avatars 縺ｮ螟夜Κ URL
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
                    aria-label="繝励Ο繝輔ぅ繝ｼ繝ｫ逕ｻ蜒上ｒ蜑企勁"
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
                  逕ｻ蜒上ｒ驕ｸ謚・                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
            <label htmlFor="profile-setup-custom-id" className="text-sm font-bold text-zinc-200">
              繧ｫ繧ｹ繧ｿ繝ID・井ｻｻ諢上・險ｭ螳壽耳螂ｨ・・            </label>
            <Input
              id="profile-setup-custom-id"
              value={customId}
              onChange={(e) => setCustomId(normalizeCustomId(e.target.value))}
              placeholder="萓・ taro_fit"
              className={`mt-2 border-zinc-700 placeholder:text-zinc-500 ${
                customIdLocked
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-400 opacity-100"
                  : "bg-zinc-950 text-zinc-100 focus-visible:ring-red-500"
              }`}
              aria-describedby="profile-setup-custom-id-hint"
              disabled={customIdLocked}
            />
            <p id="profile-setup-custom-id-hint" className="mt-2 text-xs leading-relaxed text-zinc-500">
              繝励Ο繝輔ぅ繝ｼ繝ｫURL繧定ｦ九ｄ縺吶￥縺ｧ縺阪∪縺呻ｼ井ｾ・ 縲師aro_fit縲上→縺励◆蝣ｴ蜷医・              {`${siteBaseUrl}/profile/taro_fit`} 縺ｮ繧医≧縺ｫ陦ｨ遉ｺ縺輔ｌ縺ｾ縺呻ｼ峨り恭蟆乗枚蟄励〒髢句ｧ九＠縲・縲・0譁・ｭ励・闍ｱ蟆乗枚蟄励・謨ｰ蟄励・繧｢繝ｳ繝繝ｼ繝舌・繝ｻ繝上う繝輔Φ縺御ｽｿ縺医∪縺吶・              荳蠎ｦ險ｭ螳壹＠縺溘き繧ｹ繧ｿ繝ID縺ｯ螟画峩縺ｧ縺阪∪縺帙ｓ縺ｮ縺ｧ縺疲ｳｨ諢上￥縺縺輔＞縲・            </p>
            {customIdLocked ? (
              <p className="mt-1 text-xs font-semibold text-zinc-400">
                險ｭ螳壽ｸ医∩縺ｮ縺溘ａ縲√き繧ｹ繧ｿ繝ID縺ｯ邱ｨ髮・〒縺阪∪縺帙ｓ縲・              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
            <label htmlFor="bio" className="text-sm font-bold text-zinc-200">
              閾ｪ蟾ｱ邏ｹ莉・            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="閾ｪ蛻・・蠕玲э縺ｪ縺薙→繧・ｵ梧ｭｴ縲∝・譛阪＠縺溘＞縺薙→縺ｪ縺ｩ"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
            <label htmlFor="fitness_history" className="text-sm font-bold text-zinc-200">
              繝輔ぅ繝・ヨ繝阪せ豁ｴ
            </label>
            <textarea
              id="fitness_history"
              value={fitnessHistory}
              onChange={(e) => setFitnessHistory(e.target.value)}
              rows={4}
              placeholder="萓具ｼ壹ず繝豁ｴ3蟷ｴ縲・ｱ譛ｫ縺ｯ繝ｩ繝ｳ繝九Φ繧ｰ縺ｪ縺ｩ"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
            <p className="text-sm font-bold text-zinc-200">闊亥袖縺ｮ縺ゅｋ蛻・㍽</p>
            <p className="mt-1 text-xs text-zinc-500">隍・焚驕ｸ謚槭〒縺阪∪縺・/p>
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
                菫晏ｭ倅ｸｭ...
              </>
            ) : (
              "菫晏ｭ倥☆繧・
            )}
          </Button>
        </form>
      </div>

      {typeof document !== "undefined" &&
        showCustomIdConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
            role="presentation"
            onClick={handleCustomIdConfirmCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-setup-custom-id-confirm-title"
              className="my-auto w-full max-w-md shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="profile-setup-custom-id-confirm-title"
                className="text-base font-semibold leading-relaxed text-zinc-100"
              >
                繧ｫ繧ｹ繧ｿ繝ID險ｭ螳壹・遒ｺ隱・              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                縺薙・ID縺ｧ險ｭ螳壹☆繧九→縲√・繝ｭ繝輔ぅ繝ｼ繝ｫURL縺ｯ莉･荳九↓縺ｪ繧翫∪縺吶・              </p>
              <div className="mt-3 rounded-lg border border-red-500/35 bg-zinc-900 px-3 py-2 font-mono text-sm text-red-200 break-all">
                {siteBaseUrl}/profile/{pendingCustomIdForConfirm}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                繧ｫ繧ｹ繧ｿ繝ID縺ｯ荳蠎ｦ險ｭ螳壹☆繧九→螟画峩縺ｧ縺阪∪縺帙ｓ縲ゅ％縺ｮ蜀・ｮｹ縺ｧ菫晏ｭ倥＠縺ｾ縺吶°・・              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={handleCustomIdConfirmCancel}
                  disabled={saving}
                >
                  謌ｻ繧・                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-500"
                  onClick={handleCustomIdConfirmProceed}
                  disabled={saving}
                >
                  縺薙・ID縺ｧ菫晏ｭ倥☆繧・                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
