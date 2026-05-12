"use client"

import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Info, Loader2, MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getIsAdminFromProfile } from "@/lib/admin"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { ThumbnailCropModal } from "@/components/thumbnail-crop-modal"
import { TradeFinalConfirmStep } from "@/components/TradeFinalConfirmStep"
import { DEFAULT_SKILL_THUMBNAIL_PATH } from "@/lib/skill-thumbnail"
import { SKILL_CATEGORY_OPTIONS as CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { PREFECTURE_OPTIONS } from "@/lib/prefectures"
import { fetchConsultationSettings, toConsultationSkillId } from "@/lib/consultation"
import { computeSellerFeePreview, SELLER_FEE_RATE } from "@/lib/seller-fee-preview"

type LessonFormat = "onsite" | "online"

const MIN_PRICE_YEN = 500

function getPriceHintMessage(priceInput: string): string {
  const trimmed = priceInput.trim()
  if (!trimmed) {
    return ""
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n)) {
    return ""
  }
  if (n < MIN_PRICE_YEN) {
    return `譛菴朱≡鬘阪・${MIN_PRICE_YEN}蜀・〒縺兪
  }
  return ""
}

const DEFAULT_FORM = {
  title: "",
  targetAudience: "",
  description: "",
  category: "",
  price: "",
  durationMinutes: "",
  maxCapacity: "",
  format: "online" as LessonFormat,
  prefecture: "",
}

const DEFAULT_CONSULTATION_LABELS = {
  q1: "",
  q2: "",
  q3: "",
  free: "",
}

const CONSULTATION_LABEL_PLACEHOLDERS = {
  q1: "萓・: 迴ｾ蝨ｨ縺ｮ謔ｩ縺ｿ繧呈蕗縺医※縺上□縺輔＞",
  q2: "萓・: 逶ｮ讓吶ｒ謨吶∴縺ｦ縺上□縺輔＞",
  q3: "萓・: 縺薙ｌ縺ｾ縺ｧ縺ｮ驕句虚邨碁ｨ薙ｒ謨吶∴縺ｦ縺上□縺輔＞",
  free: "萓・: 縺昴・莉悶∽ｺ句燕縺ｫ莨昴∴縺ｦ縺翫″縺溘＞縺薙→",
}

function RequiredFieldMark() {
  return <span className="ml-1.5 text-xs font-medium text-red-500">蠢・・/span>
}

type SkillRow = {
  id: string
  user_id: string
  title: string
  target_audience: string
  description: string
  category: string
  price: number
  duration_minutes: number
  max_capacity: number
  format: LessonFormat
  location_prefecture: string | null
  thumbnail_url: string | null
  is_published: boolean | null
  admin_publish_locked: boolean | null
}

async function isStripeChargeEnabledForSeller(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_connect_charges_enabled")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return false
  }

  return (data as { stripe_connect_charges_enabled?: boolean | null } | null)?.stripe_connect_charges_enabled === true
}

function revokeThumbnailPreviewIfBlob(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

function CreateSkillPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editParam = searchParams.get("edit")

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState("")
  const [thumbnailPreview, setThumbnailPreview] = useState("")
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [priceError, setPriceError] = useState("")
  const [editSkillId, setEditSkillId] = useState<string | null>(null)
  const [editLoadFinished, setEditLoadFinished] = useState(() => editParam == null)
  const [isPublished, setIsPublished] = useState(true)
  const [initialIsPublished, setInitialIsPublished] = useState(true)
  const [adminPublishLocked, setAdminPublishLocked] = useState(false)
  const [showVisibilitySaveConfirm, setShowVisibilitySaveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)
  const [finalConfirmKey, setFinalConfirmKey] = useState(0)
  const [portalReady, setPortalReady] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [consultationEnabled, setConsultationEnabled] = useState(false)
  const [chatConsultationEnabled, setChatConsultationEnabled] = useState(false)
  const [consultationLabels, setConsultationLabels] = useState(DEFAULT_CONSULTATION_LABELS)
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!editParam) {
      setEditSkillId(null)
      setEditLoadFinished(true)
      setForm(DEFAULT_FORM)
      setIsPublished(true)
      setInitialIsPublished(true)
      setThumbnailFile(null)
      setThumbnailUrl("")
      setThumbnailPreview((prev) => {
        revokeThumbnailPreviewIfBlob(prev)
        return ""
      })
      setConsultationEnabled(false)
      setChatConsultationEnabled(false)
      setConsultationLabels(DEFAULT_CONSULTATION_LABELS)
      return
    }
    setEditLoadFinished(false)
  }, [editParam])

  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (error || !data.user) {
        router.replace("/login")
        return
      }

      const adminFlag = await getIsAdminFromProfile(supabase, data.user.id)
      setIsAdmin(adminFlag)

      const stripeChargeEnabled = await isStripeChargeEnabledForSeller(supabase, data.user.id)
      if (!stripeChargeEnabled) {
        router.replace("/mypage?tab=payout")
        return
      }

      setUserId(data.user.id)
      setIsCheckingAuth(false)
    }

    void checkAuth()

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  useEffect(() => {
    if (!userId || !editParam) {
      return
    }

    let cancelled = false

    const load = async () => {
      const { data, error } = await supabase
        .from("skills")
        .select(
          "id, user_id, title, target_audience, description, category, price, duration_minutes, max_capacity, format, location_prefecture, thumbnail_url, is_published, admin_publish_locked",
        )
        .eq("id", editParam)
        .maybeSingle()

      if (cancelled) {
        return
      }

      if (error || !data) {
        setNotice({ variant: "error", message: "邱ｨ髮・ｯｾ雎｡縺ｮ繧ｹ繧ｭ繝ｫ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲・ })
        setEditSkillId(null)
        setEditLoadFinished(true)
        return
      }

      const row = data as SkillRow

      if (row.user_id !== userId) {
        router.replace("/mypage")
        return
      }

      const fmt = row.format === "onsite" || row.format === "online" ? row.format : "online"
      setForm({
        title: row.title ?? "",
        targetAudience: row.target_audience ?? "",
        description: row.description ?? "",
        category: row.category ?? "",
        price: row.price != null ? String(row.price) : "",
        durationMinutes: row.duration_minutes != null ? String(row.duration_minutes) : "",
        maxCapacity: row.max_capacity != null ? String(row.max_capacity) : "",
        format: fmt,
        prefecture: row.location_prefecture?.trim() ?? "",
      })
      setEditSkillId(row.id)
      const lockedByAdmin = row.admin_publish_locked === true
      const published = lockedByAdmin ? false : row.is_published !== false
      setAdminPublishLocked(lockedByAdmin)
      setIsPublished(published)
      setInitialIsPublished(published)

      const tu = row.thumbnail_url?.trim()
      if (tu) {
        setThumbnailUrl(tu)
        setThumbnailFile(null)
        setThumbnailPreview(tu)
      } else {
        setThumbnailUrl("")
        setThumbnailFile(null)
        setThumbnailPreview("")
      }

      const skillIdAsNumber = toConsultationSkillId(row.id)
      if (skillIdAsNumber != null) {
        const settings = await fetchConsultationSettings(supabase, skillIdAsNumber)
        if (settings) {
          setConsultationEnabled(settings.is_enabled)
          setChatConsultationEnabled(Boolean(settings.is_chat_enabled))
          setConsultationLabels({
            q1: settings.q1_label?.trim() || DEFAULT_CONSULTATION_LABELS.q1,
            q2: settings.q2_label?.trim() || DEFAULT_CONSULTATION_LABELS.q2,
            q3: settings.q3_label?.trim() || DEFAULT_CONSULTATION_LABELS.q3,
            free: settings.free_label?.trim() || DEFAULT_CONSULTATION_LABELS.free,
          })
        } else {
          setConsultationEnabled(false)
          setChatConsultationEnabled(false)
          setConsultationLabels(DEFAULT_CONSULTATION_LABELS)
        }
      } else {
        setConsultationEnabled(false)
        setChatConsultationEnabled(false)
        setConsultationLabels(DEFAULT_CONSULTATION_LABELS)
      }

      setEditLoadFinished(true)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId, editParam, supabase, router])

  useEffect(() => {
    return () => {
      if (thumbnailPreview) {
        revokeThumbnailPreviewIfBlob(thumbnailPreview)
      }
    }
  }, [thumbnailPreview])

  const feePreview = useMemo(() => {
    const trimmed = form.price.trim()
    if (!trimmed) {
      return null
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) {
      return null
    }
    return computeSellerFeePreview(n)
  }, [form.price])

  const updateForm = (field: keyof typeof DEFAULT_FORM, value: string) => {
    if (field === "price") {
      setPriceError(getPriceHintMessage(value))
    }
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const closeCropModal = () => {
    setCropModalOpen(false)
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl)
      setCropSourceUrl(null)
    }
  }

  const handleCropConfirm = async (blob: Blob) => {
    const file = new File([blob], "skill-thumbnail.jpg", { type: "image/jpeg" })
    setThumbnailFile(file)
    setThumbnailUrl("")
    if (thumbnailPreview) {
      revokeThumbnailPreviewIfBlob(thumbnailPreview)
    }
    setThumbnailPreview(URL.createObjectURL(blob))
  }

  const clearThumbnailSelection = () => {
    setThumbnailFile(null)
    setThumbnailUrl("")
    if (thumbnailPreview) {
      revokeThumbnailPreviewIfBlob(thumbnailPreview)
    }
    setThumbnailPreview("")
  }

  const handleThumbnailSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setNotice(null)

    if (!file) {
      clearThumbnailSelection()
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
    const sourceUrl = URL.createObjectURL(file)
    setCropSourceUrl(sourceUrl)
    setCropModalOpen(true)
    event.target.value = ""
  }

  const uploadThumbnailToStorage = async (currentUserId: string) => {
    if (!thumbnailFile) {
      throw new Error("繧ｵ繝繝阪う繝ｫ逕ｻ蜒上ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・)
    }

    setIsUploadingImage(true)
    const extension =
      thumbnailFile.type === "image/jpeg" || thumbnailFile.name.toLowerCase().endsWith(".jpg")
        ? "jpg"
        : (thumbnailFile.name.split(".").pop() ?? "jpg")
    const objectKey = `${currentUserId}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from("skill-thumbnails")
      .upload(objectKey, thumbnailFile, { upsert: false })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("skill-thumbnails").getPublicUrl(objectKey)

    if (!publicUrl) {
      throw new Error("繧ｵ繝繝阪う繝ｫ逕ｻ蜒上・蜈ｬ髢偽RL蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆縲・)
    }

    setThumbnailUrl(publicUrl)
    return publicUrl
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  const handleDeleteConfirm = async () => {
    if (!userId || !editSkillId) {
      return
    }
    setIsDeleting(true)
    const { error } = await supabase.from("skills").delete().eq("id", editSkillId).eq("user_id", userId)
    setIsDeleting(false)

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "蜃ｺ蜩√・蜿悶ｊ豸医＠縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・ }),
      )
      setShowDeleteConfirm(false)
      return
    }

    setShowDeleteConfirm(false)
    router.push("/mypage")
    router.refresh()
  }

  const upsertConsultationSettingsForSkill = async (skillId: string | number, payload: {
    q1: string
    q2: string
    q3: string
    free: string
    preOfferEnabled: boolean
    chatEnabled: boolean
  }) => {
    const settingSkillId = toConsultationSkillId(skillId)
    if (settingSkillId == null) {
      throw new Error("逶ｸ隲・ｨｭ螳壹・菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆・医せ繧ｭ繝ｫID蠖｢蠑上お繝ｩ繝ｼ・峨・)
    }
    const { error: consultationError } = await supabase.from("consultation_settings").upsert(
      {
        skill_id: settingSkillId,
        q1_label: payload.q1,
        q2_label: payload.q2,
        q3_label: payload.q3,
        free_label: payload.free,
        is_enabled: payload.preOfferEnabled,
        is_chat_enabled: payload.chatEnabled,
      },
      { onConflict: "skill_id" },
    )
    if (consultationError) {
      throw consultationError
    }
    return settingSkillId
  }

  const validateForSubmit = (): boolean => {
    setNotice(null)
    if (!userId) {
      router.replace("/login")
      return false
    }

    const title = form.title.trim()
    const targetAudience = form.targetAudience.trim()
    const description = form.description.trim()
    const category = form.category
    const priceTrimmed = form.price.trim()
    const price = Number(priceTrimmed)
    const durationMinutes = Number(form.durationMinutes)
    const maxCapacity = Number(form.maxCapacity)
    const q1 = consultationLabels.q1.trim()

    if (
      !title ||
      !targetAudience ||
      !description ||
      !category ||
      !priceTrimmed ||
      !Number.isFinite(price) ||
      !Number.isFinite(durationMinutes) ||
      !Number.isFinite(maxCapacity)
    ) {
      setNotice({ variant: "error", message: "蠢・磯・岼縺悟・蜉帙＆繧後※縺・∪縺帙ｓ縲・ })
      return false
    }

    const priceHint = getPriceHintMessage(priceTrimmed)
    if (priceHint) {
      setPriceError(priceHint)
      return false
    }

    if (form.format === "onsite" && !form.prefecture) {
      setNotice({ variant: "error", message: "蟇ｾ髱｢繝ｬ繝・せ繝ｳ縺ｮ蝣ｴ蜷医・驛ｽ驕灘ｺ懃恁繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲・ })
      return false
    }
    if (consultationEnabled && !q1) {
      setNotice({ variant: "error", message: "莠句燕繧ｪ繝輔ぃ繝ｼ繧呈怏蜉ｹ縺ｫ縺吶ｋ蝣ｴ蜷医∬ｳｪ蝠・縺ｯ蠢・医〒縺吶・ })
      return false
    }
    return true
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || isUploadingImage) {
      return
    }
    if (!validateForSubmit()) {
      return
    }
    if (editSkillId) {
      if (adminPublishLocked && isPublished) {
        setNotice({
          variant: "error",
          message: "驕句霧縺ｫ繧医ｋ髱槫・髢九・縺溘ａ縲√＃閾ｪ霄ｫ縺ｧ蜈ｬ髢九↓謌ｻ縺吶％縺ｨ縺ｯ縺ｧ縺阪∪縺帙ｓ縲・,
        })
        return
      }
      if (isPublished !== initialIsPublished) {
        setShowVisibilitySaveConfirm(true)
        return
      }
      void executeSubmitAfterConfirm()
      return
    }
    setFinalConfirmKey((k) => k + 1)
    setShowFinalConfirm(true)
  }

  const handleVisibilitySaveCancel = () => {
    if (!isSubmitting) {
      setShowVisibilitySaveConfirm(false)
    }
  }

  const handleVisibilitySaveConfirm = () => {
    if (!isSubmitting) {
      setShowVisibilitySaveConfirm(false)
      void executeSubmitAfterConfirm()
    }
  }

  const executeSubmitAfterConfirm = async () => {
    if (isSubmitting) {
      return
    }
    if (!userId) {
      router.replace("/login")
      return
    }
    if (!validateForSubmit()) {
      setShowFinalConfirm(false)
      return
    }

    const stripeChargeEnabled = await isStripeChargeEnabledForSeller(supabase, userId)
    if (!stripeChargeEnabled) {
      setNotice({
        variant: "error",
        message: "蜃ｺ蜩√↓縺ｯ蜿｣蠎ｧ逋ｻ骭ｲ縺悟ｿ・ｦ√〒縺吶ょ｣ｲ荳翫・謖ｯ霎ｼ險ｭ螳壹°繧唄tripe逋ｻ骭ｲ繧貞ｮ御ｺ・＠縺ｦ縺上□縺輔＞縲・,
      })
      setShowFinalConfirm(false)
      router.replace("/mypage?tab=payout")
      return
    }

    const title = form.title.trim()
    const targetAudience = form.targetAudience.trim()
    const description = form.description.trim()
    const category = form.category
    const priceTrimmed = form.price.trim()
    const price = Number(priceTrimmed)
    const durationMinutes = Number(form.durationMinutes)
    const maxCapacity = Number(form.maxCapacity)
    const q1 = consultationLabels.q1.trim()
    const q2 = consultationLabels.q2.trim()
    const q3 = consultationLabels.q3.trim()
    const free = consultationLabels.free.trim()

    setIsSubmitting(true)
    try {
      let uploadedThumbnailUrl: string
      if (thumbnailFile) {
        uploadedThumbnailUrl = await uploadThumbnailToStorage(userId)
      } else if (thumbnailUrl) {
        uploadedThumbnailUrl = thumbnailUrl
      } else {
        uploadedThumbnailUrl = DEFAULT_SKILL_THUMBNAIL_PATH
      }

      const nowIso = new Date().toISOString()

      if (editSkillId) {
        const nextPublished = adminPublishLocked ? false : isPublished
        const { error } = await supabase
          .from("skills")
          .update({
            thumbnail_url: uploadedThumbnailUrl,
            title,
            target_audience: targetAudience,
            description,
            category,
            price,
            duration_minutes: durationMinutes,
            max_capacity: maxCapacity,
            format: form.format,
            location_prefecture: form.format === "onsite" ? form.prefecture : null,
            is_published: nextPublished,
            updated_at: nowIso,
          })
          .eq("id", editSkillId)
          .eq("user_id", userId)

        if (error) {
          throw error
        }

        await upsertConsultationSettingsForSkill(editSkillId, {
          q1,
          q2,
          q3,
          free,
          preOfferEnabled: consultationEnabled,
          chatEnabled: chatConsultationEnabled,
        })

        setInitialIsPublished(nextPublished)
        setPriceError("")
        router.push("/mypage?tab=listings&updated=1")
        router.refresh()
      } else {
        const { data: insertedSkill, error } = await supabase
          .from("skills")
          .insert({
            user_id: userId,
            thumbnail_url: uploadedThumbnailUrl,
            title,
            target_audience: targetAudience,
            description,
            category,
            price,
            duration_minutes: durationMinutes,
            max_capacity: maxCapacity,
            format: form.format,
            location_prefecture: form.format === "onsite" ? form.prefecture : null,
            is_published: isPublished,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("id")
          .single()

        if (error || !insertedSkill?.id) {
          throw error ?? new Error("繧ｹ繧ｭ繝ｫ菴懈・縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・)
        }

        try {
          await upsertConsultationSettingsForSkill(insertedSkill.id, {
            q1,
            q2,
            q3,
            free,
            preOfferEnabled: consultationEnabled,
            chatEnabled: chatConsultationEnabled,
          })
        } catch (consultationError) {
          // 繧ｹ繧ｭ繝ｫ菴懈・逶ｴ蠕後↓逶ｸ隲・ｨｭ螳壻ｿ晏ｭ倥′螟ｱ謨励＠縺溷ｴ蜷医・菴懈・繧ｹ繧ｭ繝ｫ繧貞炎髯､縺励※謨ｴ蜷域ｧ繧剃ｿ昴▽縲・          const { error: rollbackError } = await supabase.from("skills").delete().eq("id", insertedSkill.id).eq("user_id", userId)
          if (rollbackError) {
            console.error("[create-skill] rollback failed after consultation_settings error", {
              insertedSkillId: insertedSkill.id,
              rollbackError,
            })
          }
          throw consultationError
        }

        setNotice({ variant: "success", message: "蜃ｺ蜩√′螳御ｺ・＠縺ｾ縺励◆・・ })
        setPriceError("")
        setForm(DEFAULT_FORM)
        setThumbnailFile(null)
        setThumbnailUrl("")
        if (thumbnailPreview) {
          revokeThumbnailPreviewIfBlob(thumbnailPreview)
        }
        setThumbnailPreview("")
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      setNotice(
        toErrorNotice(error, isAdmin, {
          unknownErrorMessage: "蜃ｺ蜩√↓螟ｱ謨励＠縺ｾ縺励◆縲よ凾髢薙ｒ鄂ｮ縺・※縺願ｩｦ縺励￥縺縺輔＞",
        }),
      )
    } finally {
      setIsSubmitting(false)
      setIsUploadingImage(false)
      setShowFinalConfirm(false)
      setShowVisibilitySaveConfirm(false)
    }
  }

  if (isCheckingAuth || !editLoadFinished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" />
        {isCheckingAuth ? "繝ｭ繧ｰ繧､繝ｳ迥ｶ諷九ｒ遒ｺ隱阪＠縺ｦ縺・∪縺・.." : "繧ｹ繧ｭ繝ｫ諠・ｱ繧定ｪｭ縺ｿ霎ｼ繧薙〒縺・∪縺・.."}
      </div>
    )
  }

  const pageTitle = editSkillId ? "繧ｹ繧ｭ繝ｫ繧堤ｷｨ髮・ : "繧ｹ繧ｭ繝ｫ繧貞・蜩・
  const formTitle = editSkillId ? "邱ｨ髮・ヵ繧ｩ繝ｼ繝" : "蜃ｺ蜩√ヵ繧ｩ繝ｼ繝"
  const submitLabel = editSkillId ? "譖ｴ譁ｰ縺吶ｋ" : "蜃ｺ蜩√☆繧・

  return (
    <div className="min-h-screen bg-black pb-14 pt-8 text-zinc-50">
      <ThumbnailCropModal
        open={cropModalOpen}
        imageSrc={cropSourceUrl}
        onClose={closeCropModal}
        onConfirm={handleCropConfirm}
        isAdmin={isAdmin}
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-wide text-white">{pageTitle}</h1>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            <Link href={editSkillId ? "/mypage" : "/"}>謌ｻ繧・/Link>
          </Button>
        </div>

        <Card className="border-red-500/35 bg-zinc-950 shadow-[0_0_60px_rgba(230,74,25,0.18)]">
          <CardHeader>
            <CardTitle className="text-white">{formTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-4">
                <div className="space-y-2">
                  <label htmlFor="thumbnail" className="text-sm font-semibold text-zinc-200">
                    繧ｵ繝繝阪う繝ｫ逕ｻ蜒・                  </label>
                  {!editSkillId ? (
                    <p className="text-xs text-zinc-500">繧ｵ繝繝阪う繝ｫ逕ｻ蜒上・蠕後°繧芽ｨｭ螳壹☆繧九％縺ｨ繧ょ庄閭ｽ縺ｧ縺吶・/p>
                  ) : null}
                  <Input
                    id="thumbnail"
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                    className="sr-only"
                  />
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4">
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 w-full border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500 sm:w-auto sm:px-5"
                        onClick={() => thumbnailInputRef.current?.click()}
                      >
                        逕ｻ蜒上ｒ驕ｸ謚・                      </Button>
                      <span className="block min-h-5 break-all text-xs text-zinc-400 sm:text-sm">
                        {thumbnailFile?.name ?? "譛ｪ驕ｸ謚・}
                      </span>
                    </div>
                  </div>
                  {thumbnailPreview ? (
                    <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border border-zinc-800 sm:max-w-none sm:aspect-[16/10]">
                      {thumbnailPreview.startsWith("blob:") ? (
                        <Image
                          src={thumbnailPreview}
                          alt="繧ｵ繝繝阪う繝ｫ繝励Ξ繝薙Η繝ｼ"
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 48rem"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- 邱ｨ髮・凾縺ｯ Supabase 縺ｮ https URL 繧定｡ｨ遉ｺ縺吶ｋ縺溘ａ
                        <img
                          src={thumbnailPreview}
                          alt="繧ｵ繝繝阪う繝ｫ繝励Ξ繝薙Η繝ｼ"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={clearThumbnailSelection}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600/80 bg-black/70 text-zinc-100 transition-colors hover:border-red-500 hover:text-red-300"
                        aria-label="繧ｵ繝繝阪う繝ｫ逕ｻ蜒上ｒ蜑企勁"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">蝓ｺ譛ｬ諠・ｱ</h2>
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-semibold text-zinc-200">
                    鬘悟錐
                    <RequiredFieldMark />
                  </label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="萓・ 蛻晏ｿ・・髄縺題・驥阪ヨ繝ｬ繝ｼ繝九Φ繧ｰ"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="target_audience" className="text-sm font-semibold text-zinc-200">
                    縺薙ｓ縺ｪ莠ｺ縺ｫ縺翫☆縺吶ａ
                    <RequiredFieldMark />
                  </label>
                  <Input
                    id="target_audience"
                    value={form.targetAudience}
                    onChange={(event) => updateForm("targetAudience", event.target.value)}
                    placeholder="萓具ｼ壼・蠢・・・譁ｹ縲∝･ｳ諤ｧ縺ｮ譁ｹ縺ｪ縺ｩ"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-semibold text-zinc-200">
                    隱ｬ譏・                    <RequiredFieldMark />
                  </label>
                  <textarea
                    id="description"
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    rows={7}
                    placeholder="閾ｪ蟾ｱ邏ｹ莉九∵欠蟆取婿驥晢ｼ・oom繧ШouTube繧剃ｽｿ縺｣縺滓欠蟆弱せ繧ｿ繧､繝ｫ縺ｪ縺ｩ・峨∵欠蟆弱・豬√ｌ縲∵ｺ門ｙ縺励※縺・◆縺縺上ｂ縺ｮ・磯°蜍輔〒縺阪ｋ譛崎｣・・｣ｲ縺ｿ迚ｩ縺ｪ縺ｩ・峨↑縺ｩ繧定・逕ｱ縺ｫ險倩ｼ峨＠縺ｦ縺上□縺輔＞縲・
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="inline-flex items-start gap-1.5 text-xs text-zinc-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                    螟夜Κ繧ｵ繝ｼ繝薙せ・・oom遲会ｼ峨ｒ蛻ｩ逕ｨ縺吶ｋ蝣ｴ蜷医・縲√ヨ繝ｩ繝悶Ν髦ｲ豁｢縺ｮ縺溘ａ蠢・★隱ｬ譏取ｬ・↓險倩ｼ峨＠縺ｦ縺上□縺輔＞縲・                  </p>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">謠蝉ｾ帶婿豕・/h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="category" className="text-sm font-semibold text-zinc-200">
                      繧ｫ繝・ざ繝ｪ繝ｼ・・0髻ｳ鬆・ｼ・                      <RequiredFieldMark />
                    </label>
                    <select
                      id="category"
                      value={form.category}
                      onChange={(event) => updateForm("category", event.target.value)}
                      className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                      {CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="format" className="text-sm font-semibold text-zinc-200">
                      蠖｢蠑・                      <RequiredFieldMark />
                    </label>
                    <select
                      id="format"
                      value={form.format}
                      onChange={(event) => {
                        const nextFormat = event.target.value as LessonFormat
                        setForm((previous) => ({
                          ...previous,
                          format: nextFormat,
                          prefecture: nextFormat === "online" ? "" : previous.prefecture,
                        }))
                      }}
                      className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="online">繧ｪ繝ｳ繝ｩ繧､繝ｳ</option>
                      <option value="onsite">蟇ｾ髱｢</option>
                    </select>
                  </div>
                </div>

                {form.format === "onsite" && (
                  <div className="space-y-2">
                    <label htmlFor="prefecture" className="text-sm font-semibold text-zinc-200">
                      蝣ｴ謇・磯・驕灘ｺ懃恁・・                      <RequiredFieldMark />
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-red-400" />
                      <select
                        id="prefecture"
                        value={form.prefecture}
                        onChange={(event) => updateForm("prefecture", event.target.value)}
                        className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">驛ｽ驕灘ｺ懃恁繧帝∈謚槭＠縺ｦ縺上□縺輔＞</option>
                        {PREFECTURE_OPTIONS.map((prefecture) => (
                          <option key={prefecture} value={prefecture}>
                            {prefecture}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">萓｡譬ｼ繝ｻ謠蝉ｾ帶擅莉ｶ</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="price" className="text-sm font-semibold text-zinc-200">
                      蛟､谿ｵ・亥・・・                      <RequiredFieldMark />
                    </label>
                    <Input
                      id="price"
                      type="number"
                      min={MIN_PRICE_YEN}
                      value={form.price}
                      onChange={(event) => updateForm("price", event.target.value)}
                      placeholder="萓・ 3500"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                      aria-invalid={Boolean(priceError)}
                      aria-describedby={
                        [priceError ? "price-error" : null, feePreview ? "price-fee-preview" : null]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                    />
                    {feePreview ? (
                      <div id="price-fee-preview" className="mt-2 space-y-1 text-sm text-zinc-400">
                        <p>
                          謇区焚譁呻ｼ・Math.round(SELLER_FEE_RATE * 100)}%・・ {feePreview.feeYen.toLocaleString("ja-JP")}蜀・                        </p>
                        <p className="font-medium text-zinc-300">
                          縺ゅ↑縺溘・蜿怜叙鬘・ {feePreview.receiveYen.toLocaleString("ja-JP")}蜀・                        </p>
                      </div>
                    ) : null}
                    {priceError ? (
                      <p id="price-error" className="text-sm font-medium text-red-500">
                        {priceError}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="duration" className="text-sm font-semibold text-zinc-200">
                      1蝗槭≠縺溘ｊ縺ｮ譎る俣・亥・・・                      <RequiredFieldMark />
                    </label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={form.durationMinutes}
                      onChange={(event) => updateForm("durationMinutes", event.target.value)}
                      placeholder="萓・ 60"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="max-capacity" className="text-sm font-semibold text-zinc-200">
                      譛螟ｧ蟇ｾ蠢應ｺｺ謨ｰ
                      <RequiredFieldMark />
                    </label>
                    <Input
                      id="max-capacity"
                      type="number"
                      min={1}
                      value={form.maxCapacity}
                      onChange={(event) => updateForm("maxCapacity", event.target.value)}
                      placeholder="萓・ 5"
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                    />
                  </div>
                </div>
              </section>

              <fieldset className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                <legend className="px-1 text-sm font-semibold text-zinc-200">莠句燕繧ｪ繝輔ぃ繝ｼ險ｭ螳・/legend>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-red-600 focus:ring-red-500"
                    checked={consultationEnabled}
                    onChange={(event) => setConsultationEnabled(event.target.checked)}
                  />
                  莠句燕繧ｪ繝輔ぃ繝ｼ・郁ｳｪ蝠上ヵ繧ｩ繝ｼ繝・峨ｒ蜿励￠莉倥￠繧・                </label>
                <p className="text-xs text-zinc-500">
                  繧ｪ繝ｳ縺ｫ縺吶ｋ縺ｨ縲∬ｳｼ蜈･蜑阪↓蝗樒ｭ斐ヵ繧ｩ繝ｼ繝縺ｨ隰帛ｸｫ縺ｮ謇ｿ隱阪′蠢・ｦ√↓縺ｪ繧翫∪縺呻ｼ郁ｳｪ蝠上Λ繝吶Ν繧定ｨｭ螳壹＠縺ｦ縺上□縺輔＞・峨・                </p>
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <label htmlFor="consultation-q1" className="inline-flex items-center text-xs font-semibold text-zinc-400">
                      雉ｪ蝠・
                      {consultationEnabled ? <RequiredFieldMark /> : null}
                    </label>
                    <Input
                      id="consultation-q1"
                      value={consultationLabels.q1}
                      onChange={(event) =>
                        setConsultationLabels((prev) => ({ ...prev, q1: event.target.value }))
                      }
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                      placeholder={CONSULTATION_LABEL_PLACEHOLDERS.q1}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-q2" className="text-xs font-semibold text-zinc-400">
                      雉ｪ蝠・
                    </label>
                    <Input
                      id="consultation-q2"
                      value={consultationLabels.q2}
                      onChange={(event) =>
                        setConsultationLabels((prev) => ({ ...prev, q2: event.target.value }))
                      }
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                      placeholder={CONSULTATION_LABEL_PLACEHOLDERS.q2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-q3" className="text-xs font-semibold text-zinc-400">
                      雉ｪ蝠・
                    </label>
                    <Input
                      id="consultation-q3"
                      value={consultationLabels.q3}
                      onChange={(event) =>
                        setConsultationLabels((prev) => ({ ...prev, q3: event.target.value }))
                      }
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                      placeholder={CONSULTATION_LABEL_PLACEHOLDERS.q3}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="consultation-free" className="text-xs font-semibold text-zinc-400">
                      閾ｪ逕ｱ險倩ｿｰ
                    </label>
                    <Input
                      id="consultation-free"
                      value={consultationLabels.free}
                      onChange={(event) =>
                        setConsultationLabels((prev) => ({ ...prev, free: event.target.value }))
                      }
                      className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                      placeholder={CONSULTATION_LABEL_PLACEHOLDERS.free}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                <legend className="px-1 text-sm font-semibold text-zinc-200">莠句燕逶ｸ隲・ｼ医メ繝｣繝・ヨ・芽ｨｭ螳・/legend>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-red-600 focus:ring-red-500"
                    checked={chatConsultationEnabled}
                    onChange={(event) => setChatConsultationEnabled(event.target.checked)}
                  />
                  雉ｼ蜈･蜑阪・繝√Ε繝・ヨ逶ｸ隲・ｒ蜿励￠莉倥￠繧・                </label>
                <p className="text-xs text-zinc-500">
                  繧ｪ繝ｳ縺ｫ縺吶ｋ縺ｨ縲√せ繧ｭ繝ｫ隧ｳ邏ｰ縺ｫ縲悟・蜩∬・↓雉ｪ蝠上☆繧九阪′陦ｨ遉ｺ縺輔ｌ縲∝叙蠑募燕縺ｮ繝｡繝・そ繝ｼ繧ｸ縺ｮ繧・ｊ蜿悶ｊ縺後〒縺阪∪縺吶・                </p>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                <legend className="px-1 text-sm font-semibold text-zinc-200">蜈ｬ髢玖ｨｭ螳・/legend>
                <div className="flex flex-wrap gap-4">
                  <label
                    className={`flex items-center gap-2 text-sm text-zinc-200 ${
                      adminPublishLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="skill-visibility"
                      className="h-4 w-4 border-zinc-600 text-red-600 focus:ring-red-500"
                      checked={isPublished}
                      disabled={adminPublishLocked}
                      onChange={() => setIsPublished(true)}
                    />
                    蜈ｬ髢倶ｸｭ
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="radio"
                      name="skill-visibility"
                      className="h-4 w-4 border-zinc-600 text-red-600 focus:ring-red-500"
                      checked={!isPublished}
                      onChange={() => setIsPublished(false)}
                    />
                    髱槫・髢・                  </label>
                </div>
                {adminPublishLocked ? (
                  <p className="text-xs text-amber-200">
                    驕句霧縺ｫ繧医ｊ髱槫・髢九・縺溘ａ縲√＃閾ｪ霄ｫ縺ｧ蜈ｬ髢九↓謌ｻ縺吶％縺ｨ縺ｯ縺ｧ縺阪∪縺帙ｓ縲・                  </p>
                ) : null}
              </fieldset>

              <Button
                type="submit"
                disabled={isSubmitting || isUploadingImage}
                className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
              >
                {isSubmitting || isUploadingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploadingImage ? "逕ｻ蜒上い繝・・繝ｭ繝ｼ繝我ｸｭ..." : "菫晏ｭ倅ｸｭ..."}
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </form>

            {editSkillId ? (
              <div className="mt-6 border-t border-zinc-800 pt-6">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full bg-red-700 text-white hover:bg-red-600"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting || isUploadingImage || isDeleting}
                >
                  蜃ｺ蜩√ｒ蜿悶ｊ豸医☆
                </Button>
                <p className="mt-2 text-center text-xs text-zinc-500">蜿悶ｊ豸医☆縺ｨ縺薙・蜃ｺ蜩√ョ繝ｼ繧ｿ縺ｯ蜑企勁縺輔ｌ縺ｾ縺呻ｼ亥・縺ｫ謌ｻ縺帙∪縺帙ｓ縺ｮ縺ｧ縺疲ｳｨ諢上￥縺縺輔＞・峨・/p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {portalReady &&
        showVisibilitySaveConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
            role="presentation"
            onClick={handleVisibilitySaveCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="visibility-save-confirm-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="visibility-save-confirm-title"
                className="text-center text-base font-semibold leading-relaxed text-zinc-100"
              >
                {isPublished ? "縺薙・繧ｹ繧ｭ繝ｫ繧貞・髢九＠縺ｦ菫晏ｭ倥＠縺ｾ縺吶°・・ : "縺薙・繧ｹ繧ｭ繝ｫ繧帝撼蜈ｬ髢九↓縺励※菫晏ｭ倥＠縺ｾ縺吶°・・}
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-400">
                {isPublished
                  ? "菫晏ｭ倥☆繧九→繧ｹ繧ｭ繝ｫ荳隕ｧ縺ｫ陦ｨ遉ｺ縺輔ｌ縲∬ｳｼ蜈･閠・′髢ｲ隕ｧ縺ｧ縺阪ｋ迥ｶ諷九↓縺ｪ繧翫∪縺吶・
                  : "菫晏ｭ倥☆繧九→繧ｹ繧ｭ繝ｫ荳隕ｧ縺九ｉ髱櫁｡ｨ遉ｺ縺ｫ縺ｪ繧翫∪縺呻ｼ医☆縺ｧ縺ｫ髢句ｧ九＠縺溷叙蠑輔↓縺ｯ蠖ｱ髻ｿ縺励∪縺帙ｓ・峨・}
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 border-zinc-600 bg-zinc-800 font-medium text-zinc-100 hover:bg-zinc-700"
                  onClick={handleVisibilitySaveCancel}
                  disabled={isSubmitting}
                >
                  繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-medium text-white hover:bg-red-500"
                  onClick={handleVisibilitySaveConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      菫晏ｭ倅ｸｭ...
                    </>
                  ) : (
                    "菫晏ｭ倥☆繧・
                  )}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {portalReady &&
        showDeleteConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
            role="presentation"
            onClick={handleDeleteCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-skill-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-skill-title" className="text-center text-base font-semibold leading-relaxed text-zinc-100">
                縺薙・蜃ｺ蜩√ｒ蜿悶ｊ豸医＠縺ｾ縺吶°・・              </h2>
              <p className="mt-2 text-center text-sm text-zinc-400">蜑企勁縺吶ｋ縺ｨ蠕ｩ蜈・〒縺阪∪縺帙ｓ縲・/p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 border-zinc-600 bg-zinc-800 font-medium text-zinc-100 hover:bg-zinc-700"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                >
                  繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-medium text-white hover:bg-red-500"
                  onClick={() => void handleDeleteConfirm()}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      蜑企勁荳ｭ...
                    </>
                  ) : (
                    "蜿悶ｊ豸医☆"
                  )}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {portalReady &&
        showFinalConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
            role="presentation"
            onClick={() => {
              if (!isSubmitting) {
                setShowFinalConfirm(false)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="final-confirm-skill-title"
              className="my-auto w-full max-w-lg shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="final-confirm-skill-title" className="text-center text-base font-semibold text-zinc-100">
                譛邨ら｢ｺ隱・              </h2>
              <p className="mt-1 text-center text-xs text-zinc-500">蜀・ｮｹ繧偵＃遒ｺ隱阪・縺・∴縲∝酔諢上＠縺ｦ謇狗ｶ壹″繧貞ｮ御ｺ・＠縺ｦ縺上□縺輔＞縲・/p>
              <p className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-center text-sm text-zinc-300">
                蜈ｬ髢玖ｨｭ螳・{" "}
                <span className="font-semibold text-zinc-100">
                  {isPublished ? "蜈ｬ髢倶ｸｭ・井ｸ隕ｧ縺ｫ陦ｨ遉ｺ・・ : "髱槫・髢具ｼ井ｸ隕ｧ縺ｫ縺ｯ陦ｨ遉ｺ縺励∪縺帙ｓ・・}
                </span>
              </p>
              <div className="mt-5">
                <TradeFinalConfirmStep
                  variant="seller"
                  resetKey={finalConfirmKey}
                  actionLabel={editSkillId ? "譖ｴ譁ｰ縺吶ｋ" : "蜃ｺ蜩√☆繧・}
                  isLoading={isSubmitting}
                  showCancelButton
                  cancelLabel="謌ｻ繧・
                  onCancel={() => {
                    if (!isSubmitting) {
                      setShowFinalConfirm(false)
                    }
                  }}
                  onConfirm={() => void executeSubmitAfterConfirm()}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function CreateSkillPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" />
          隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...
        </div>
      }
    >
      <CreateSkillPageContent />
    </Suspense>
  )
}
