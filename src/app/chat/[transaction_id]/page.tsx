"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Link2, Loader2, Plus, Send, X } from "lucide-react"
import PinchZoom, { make3dTransformValue, type UpdateAction } from "react-quick-pinch-zoom"
import { ChatLinkIntegrationModal } from "@/components/chat-link-integration-modal"
import { ChatLinkMessageCard } from "@/components/chat-link-message-card"
import { ChatYoutubeRich } from "@/components/chat-youtube-rich"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getBanStatusFromProfile } from "@/lib/ban"
import {
  CHAT_LINK_FILE_TYPE,
  CHAT_YOUTUBE_FILE_TYPE,
  extractYoutubeUrlFromPlainContent,
  type LinkMessagePayload,
  normalizeYoutubeUrlForPlayer,
  parseLinkMessageContent,
  serializeLinkPayload,
} from "@/lib/chat-link-payload"
import { ProfileAvatar } from "@/components/profile-avatar"
import { buildProfilePath } from "@/lib/profile-path"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { autoCompleteMyPendingTransactionsWithPayout, completeTransactionWithPayout } from "@/actions/payout"
import { createTransactionNotification, NOTIFICATION_TYPE } from "@/lib/transaction-notifications"
import { DisputeEvidenceImage } from "@/components/DisputeEvidenceImage"
import { ChatAttachmentFileCard } from "@/components/chat/ChatAttachmentFileCard"
import { ChatComposerTextarea } from "@/components/chat/ChatComposerTextarea"
import { TransactionReviewCard } from "@/components/chat/TransactionReviewCard"
import {
  buildChatFileMessageContent,
  buildChatFileUploadPath,
  CHAT_FILE_INPUT_ACCEPT,
  CHAT_MEDIA_BUCKET,
  classifyChatFile,
  displayFileNameFromStoragePath,
  isMessageGenericAttachmentType,
  isMessageImageType,
  isMessageVideoType,
  messageDisplayText,
  parseChatFileMessageContent,
  storedFileTypeForUpload,
  validateChatAttachmentFile,
} from "@/lib/chat-file-attachments"
import { fetchMyTransactionReview, type TransactionReviewRow } from "@/lib/transaction-reviews"
import { ALLOWED_EXTERNAL_TOOLS_SLASH } from "@/lib/allowed-external-tools"
import { lookupJaMessage } from "@/lib/i18n/ja-canonical"
import { chatUi } from "@/lib/chat-ui"
import { safeClientLogError } from "@/lib/safe-client-log"
import { cn } from "@/lib/utils"
import type { AppNotice } from "@/lib/notifications"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"
import { localeToHtmlLang } from "@/lib/i18n/locales"

/** `transactions` テーブル（定義どおり） */
type TransactionRow = {
  id: number | string
  skill_id: number | string
  buyer_id: string
  seller_id: string
  price: number
  status: string
  completed_at: string | null
  applied_at: string | null
  auto_complete_at: string | null
  disputed_reason: string | null
  disputed_reason_detail: string | null
  disputed_evidence_url: string | null
  disputed_at: string | null
}

type ProfileLite = {
  display_name: string | null
  avatar_url: string | null
  custom_id: string | null
}

type SenderProfileRow = ProfileLite & { id: string }

/** `messages` テーブル（定義どおり） */
type MessageRow = {
  id: number | string
  transaction_id: number | string
  sender_id: string
  content: string
  file_url: string | null
  file_type: string | null
  is_read: boolean
  created_at: string
}

type ExpandedMedia = {
  url: string
  type: "image" | "video"
}

function extractSupabaseErrorDetails(error: unknown): {
  message: string
  code: string | null
  details: string | null
  hint: string | null
} {
  const e = (error ?? {}) as {
    message?: string
    code?: string
    details?: string
    hint?: string
  }
  return {
    message: e.message ?? "unknown error",
    code: e.code ?? null,
    details: e.details ?? null,
    hint: e.hint ?? null,
  }
}

/** Supabase Storage のバケット ID（必ず `dispute-evidence` と一致させる） */
const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence" as const
const MAX_DISPUTE_EVIDENCE_BYTES = 10 * 1024 * 1024

/** LIKE やストレージで問題になりやすい文字を除き、encodeURIComponent で `%` が増えすぎないよう ASCII に寄せる */
function sanitizeDisputeEvidenceFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "image"
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180)
}

/** 制御文字・パス区切りを除き、セグメントを encodeURIComponent でエスケープする */
function encodeDisputeEvidencePathSegment(segment: string): string {
  const cleaned = segment
    .replace(/[\u0000-\u001f\u007f\\]/g, "")
    .replace(/\//g, "_")
    .trim()
  return encodeURIComponent(cleaned)
}

function buildDisputeEvidenceUploadPath(
  userIdParam: string,
  transactionIdParam: string,
  file: File,
): string {
  const safeName = sanitizeDisputeEvidenceFileName(file.name)
  const fileSegment = `${Date.now()}_${safeName}`
  return [
    encodeDisputeEvidencePathSegment(userIdParam),
    encodeDisputeEvidencePathSegment(transactionIdParam),
    encodeDisputeEvidencePathSegment(fileSegment),
  ].join("/")
}

function logDisputeEvidenceUploadError(
  context: string,
  bucket: string,
  uploadPath: string,
  file: File,
  error: unknown,
) {
  console.error(`[Chat][${bucket}] ${context}`, { bucket, uploadPath })
  console.error(`[Chat][${bucket}] client file`, {
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown> & { message?: string; error?: string }
    console.error(`[Chat][${bucket}] error.message:`, e.message)
    console.error(`[Chat][${bucket}] error.error (code):`, e.error)
    console.error(`[Chat][${bucket}] error.name:`, e.name)
    console.error(`[Chat][${bucket}] error.statusCode:`, e.statusCode)
    console.error(`[Chat][${bucket}] error (full object):`, error)
    return
  }
  console.error(`[Chat][${bucket}] error (non-object):`, error)
}

const CHAT_MEDIA_SIGNED_URL_TTL_SEC = 3600
const COMPLETION_PENDING_DAYS = 3

/** 講師が取引完了申請を出せる status（Stripe 決済直後の `pending` や `in_progress` を含む） */
const SELLER_APPLY_COMPLETION_STATUSES = new Set<string>(["active", "pending", "in_progress"])

const DISPUTE_REASON_OPTIONS = [
  "提供内容が事前説明と異なる",
  "講師と連絡が取れない",
  "納品物や対応に不備がある",
  "その他",
] as const

const DISPUTE_REASON_VALUE_TO_KEY: Record<string, "different" | "noContact" | "defective" | "other"> = {
  "提供内容が事前説明と異なる": "different",
  "講師と連絡が取れない": "noContact",
  "納品物や対応に不備がある": "defective",
  "その他": "other",
}

type ChatMediaSignedProps = {
  supabase: SupabaseClient
  /** ストレージオブジェクトキー（例: `18/filename.png`） */
  path: string
  fileType: string | null
  fileName?: string
  fileSizeBytes?: number | null
  mine?: boolean
  onExpand?: (media: ExpandedMedia) => void
}

function ChatMediaLoadFailedText() {
  const t = useTranslations("chat.media")
  return <p className="text-xs text-amber-800 dark:text-amber-200/90">{t("loadFailed")}</p>
}

function ChatMediaSigned({
  supabase,
  path,
  fileType,
  fileName,
  fileSizeBytes,
  mine,
  onExpand,
}: ChatMediaSignedProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(path, CHAT_MEDIA_SIGNED_URL_TTL_SEC)
      if (cancelled) {
        return
      }
      if (error || !data?.signedUrl) {
        setFailed(true)
        return
      }
      setSignedUrl(data.signedUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, path])

  if (failed) {
    return <ChatMediaLoadFailedText />
  }
  if (!signedUrl) {
    return (
      <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-border bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (isMessageVideoType(fileType)) {
    return (
      <div className="overflow-hidden rounded-lg">
        <video
          src={signedUrl}
          controls
          className="max-h-[200px] max-w-full cursor-zoom-in rounded-lg"
          preload="metadata"
          onClick={() => onExpand?.({ url: signedUrl, type: "video" })}
        />
      </div>
    )
  }

  if (isMessageGenericAttachmentType(fileType, true)) {
    return (
      <ChatAttachmentFileCard
        fileName={fileName ?? displayFileNameFromStoragePath(path)}
        fileSizeBytes={fileSizeBytes ?? null}
        downloadUrl={signedUrl}
        failed={failed}
        loading={!signedUrl && !failed}
        mine={mine}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-lg">
      {/* eslint-disable-next-line @next/next/no-img-element -- Storage 署名付き URL */}
      <img
        src={signedUrl}
        alt=""
        className="max-h-64 w-full cursor-zoom-in rounded-lg bg-black object-contain"
        onError={() => setFailed(true)}
        onClick={() => onExpand?.({ url: signedUrl, type: "image" })}
      />
    </div>
  )
}

function messageIdKey(id: unknown): string {
  return String(id)
}

function mergeMessageRow(prev: MessageRow[], row: MessageRow): MessageRow[] {
  const key = messageIdKey(row.id)
  if (prev.some((m) => messageIdKey(m.id) === key)) {
    return prev
  }
  return [...prev, row].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

/** Realtime UPDATE（既読 is_read など）で一覧の該当行を payload.new で置き換え */
function applyMessageUpdate(prev: MessageRow[], row: MessageRow): MessageRow[] {
  const key = messageIdKey(row.id)
  const idx = prev.findIndex((m) => messageIdKey(m.id) === key)
  if (idx === -1) {
    return mergeMessageRow(prev, row)
  }
  const next = [...prev]
  next[idx] = row
  return next
}

/** `created_at` を HH:mm で表示 */
function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return "—"
  }
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

/** メディアのみ送信時のプレースホルダーは本文として重複表示しない */
function shouldShowMessageText(m: MessageRow): boolean {
  if (m.file_type === CHAT_LINK_FILE_TYPE) {
    return false
  }
  if (m.file_type === CHAT_YOUTUBE_FILE_TYPE) {
    return false
  }
  if (!m.file_url && extractYoutubeUrlFromPlainContent(m.content)) {
    return false
  }
  return messageDisplayText(m).trim().length > 0
}

export default function ChatTransactionPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("chat")
  const tErr = useTranslations("chat.errors")
  const tSucc = useTranslations("chat.successes")
  const tNoti = useTranslations("chat.notifications")
  const tBanner = useTranslations("chat.banner")
  const tAct = useTranslations("chat.actions")
  const tApprov = useTranslations("chat.approvalPending")
  const tDispSub = useTranslations("chat.dispute.submission")
  const tDispForm = useTranslations("chat.dispute.form")
  const tDispReasons = useTranslations("chat.dispute.reasons")
  const tMsg = useTranslations("chat.message")
  const tComp = useTranslations("chat.composer")
  const tReqAgr = useTranslations("chat.requestAgreement")
  const tAppAgr = useTranslations("chat.approveAgreement")
  const tViewer = useTranslations("chat.viewer")
  const tHeader = useTranslations("chat.header")
  const tPeer = useTranslations("chat.peer")
  const tList = useTranslations("chat.list")
  const tSidebar = useTranslations("chat.sidebar")
  const locale = useLocale()
  const htmlLang = localeToHtmlLang(locale)
  const transactionId =
    typeof params.transaction_id === "string"
      ? params.transaction_id
      : Array.isArray(params.transaction_id)
        ? params.transaction_id[0]
        : ""

  const chatPathWithQuery = useMemo(() => {
    if (!transactionId) {
      return "/chat"
    }
    const q = searchParams.toString()
    return q ? `/chat/${transactionId}?${q}` : `/chat/${transactionId}`
  }, [transactionId, searchParams])

  const fromCheckoutFlow = searchParams.get("from") === "checkout"

  const handleHeaderBack = useCallback(() => {
    if (fromCheckoutFlow) {
      router.push("/")
      return
    }
    router.back()
  }, [fromCheckoutFlow, router])

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isBannedUser, setIsBannedUser] = useState(false)

  const [txLoading, setTxLoading] = useState(true)
  const [transaction, setTransaction] = useState<TransactionRow | null>(null)
  const [otherProfile, setOtherProfile] = useState<ProfileLite | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [messages, setMessages] = useState<MessageRow[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)

  /** sender_id → profiles の表示用キャッシュ */
  const [senderProfiles, setSenderProfiles] = useState<Record<string, ProfileLite>>({})

  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [linkSending, setLinkSending] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [expandedMedia, setExpandedMedia] = useState<ExpandedMedia | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [showDisputeReasonPicker, setShowDisputeReasonPicker] = useState(false)
  const [disputeReason, setDisputeReason] = useState<string>(DISPUTE_REASON_OPTIONS[0])
  const [disputed_reason_detail, setDisputedReasonDetail] = useState("")
  const [disputeEvidenceFile, setDisputeEvidenceFile] = useState<File | null>(null)
  const [disputeEvidencePreviewUrl, setDisputeEvidencePreviewUrl] = useState<string | null>(null)
  const [disputedEvidenceUploading, setDisputedEvidenceUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [requestAgreementOpen, setRequestAgreementOpen] = useState(false)
  const [approveAgreementOpen, setApproveAgreementOpen] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [myTransactionReview, setMyTransactionReview] = useState<TransactionReviewRow | null>(null)
  const [myTransactionReviewLoading, setMyTransactionReviewLoading] = useState(false)
  const [skillTitle, setSkillTitle] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const composerFormRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const disputeEvidenceInputRef = useRef<HTMLInputElement>(null)
  /** 異議申し立てフォーム・関連ボタン領域（外側クリックでフォームを閉じる判定用） */
  const disputeBuyerActionsRef = useRef<HTMLDivElement>(null)
  /** オーバーレイ上のフォームパネル（外側クリック判定のホワイトリスト） */
  const disputeFormPanelRef = useRef<HTMLDivElement>(null)
  const expandedImageRef = useRef<HTMLImageElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const initialAutoScrollDoneRef = useRef(false)

  const forceScrollToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true
    const el = listRef.current
    if (!el) {
      return
    }
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    })
  }, [])

  const handlePinchZoomUpdate = useCallback(({ x, y, scale }: UpdateAction) => {
    const img = expandedImageRef.current
    if (!img) {
      return
    }
    img.style.transform = make3dTransformValue({ x, y, scale })
  }, [])

  const formatAppliedDeadline = useCallback((appliedAt: string | null) => {
    if (!appliedAt) {
      return null
    }
    const d = new Date(appliedAt)
    if (Number.isNaN(d.getTime())) {
      return null
    }
    const deadline = new Date(d.getTime() + COMPLETION_PENDING_DAYS * 24 * 60 * 60 * 1000)
    return `${deadline.getFullYear()}/${String(deadline.getMonth() + 1).padStart(
      2,
      "0",
    )}/${String(deadline.getDate()).padStart(2, "0")} ${String(deadline.getHours()).padStart(
      2,
      "0",
    )}:${String(deadline.getMinutes()).padStart(2, "0")}`
  }, [])

  const handleSaveExpandedImage = useCallback(async () => {
    if (!expandedMedia || expandedMedia.type !== "image") {
      return
    }

    try {
      const response = await fetch(expandedMedia.url)
      if (!response.ok) {
        throw new Error(tErr("imageFetchFailed"))
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const parsedUrl = new URL(expandedMedia.url)
      const filenameFromPath = parsedUrl.pathname.split("/").pop() ?? ""
      const cleanFilename = filenameFromPath.split("?")[0]

      link.href = objectUrl
      link.download = cleanFilename || `chat-image-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error("【画像保存エラー】", error)
      window.alert(tErr("imageSaveFailed"))
    }
  }, [expandedMedia])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (!disputeEvidenceFile) {
      setDisputeEvidencePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(disputeEvidenceFile)
    setDisputeEvidencePreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [disputeEvidenceFile])

  /** チャット本体・ヘッダー周辺の「フォーム外」押下で閉じる（ルートで capture してメッセージ一覧も確実に拾う） */
  const dismissDisputePickerIfOutside = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!showDisputeReasonPicker) {
        return
      }
      const t = e.target
      if (!(t instanceof Node)) {
        return
      }
      const actions = disputeBuyerActionsRef.current
      const panel = disputeFormPanelRef.current
      if (actions?.contains(t) || panel?.contains(t)) {
        return
      }
      setShowDisputeReasonPicker(false)
    },
    [showDisputeReasonPicker],
  )

  const handleMessageListScroll = useCallback(() => {
    const el = listRef.current
    if (!el) {
      return
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 120
  }, [])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user) {
        router.replace(`/login?redirect=${encodeURIComponent(chatPathWithQuery)}`)
        setAuthLoading(false)
        return
      }
      setUserId(data.user.id)
      const [admin, banStatus] = await Promise.all([
        getIsAdminFromProfile(supabase, data.user.id),
        getBanStatusFromProfile(supabase, data.user.id),
      ])
      if (!mounted) {
        return
      }
      setIsAdmin(admin)
      setIsBannedUser(banStatus.isBanned && !banStatus.isAdmin)
      setAuthLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [router, supabase, transactionId, chatPathWithQuery])

  const loadTransactionAndPeer = useCallback(async () => {
    if (!transactionId || !userId) {
      return
    }
    setTxLoading(true)
    setLoadError(null)

    const { data: row, error } = await supabase
      .from("transactions")
      .select(
        "id, skill_id, buyer_id, seller_id, price, status, completed_at, applied_at, auto_complete_at, disputed_reason, disputed_reason_detail, disputed_evidence_url, disputed_at",
      )
      .eq("id", transactionId)
      .maybeSingle()

    if (error || !row) {
      setTransaction(null)
      setOtherProfile(null)
      setLoadError(tErr("txNotFound"))
      setTxLoading(false)
      return
    }

    const t = row as TransactionRow
    if (t.buyer_id !== userId && t.seller_id !== userId) {
      setTransaction(null)
      setOtherProfile(null)
      setLoadError(tErr("txAccessForbidden"))
      setTxLoading(false)
      return
    }

    const otherId = t.buyer_id === userId ? t.seller_id : t.buyer_id
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, custom_id")
      .eq("id", otherId)
      .maybeSingle()

    if (pErr) {
      setLoadError(tErr("peerProfileFailed"))
      setTransaction(t)
      setOtherProfile(null)
      setTxLoading(false)
      return
    }

    setTransaction(t)
    setOtherProfile((prof as ProfileLite) ?? { display_name: null, avatar_url: null, custom_id: null })
    setTxLoading(false)
  }, [supabase, transactionId, userId])

  useEffect(() => {
    if (userId && transactionId) {
      void loadTransactionAndPeer()
    }
  }, [userId, transactionId, loadTransactionAndPeer])

  useEffect(() => {
    if (!transaction?.skill_id) {
      setSkillTitle(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("skills")
        .select("title")
        .eq("id", transaction.skill_id)
        .maybeSingle()
      if (cancelled) {
        return
      }
      const title = (data as { title?: string | null } | null)?.title ?? null
      setSkillTitle(title && title.trim().length > 0 ? title.trim() : null)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, transaction?.skill_id])

  useEffect(() => {
    if (!transactionId || !userId || !transaction) {
      setMyTransactionReview(null)
      setMyTransactionReviewLoading(false)
      return
    }
    const terminal =
      transaction.status === "completed" ||
      transaction.status === "canceled" ||
      transaction.status === "refunded"
    if (!terminal) {
      setMyTransactionReview(null)
      setMyTransactionReviewLoading(false)
      return
    }
    let cancelled = false
    setMyTransactionReviewLoading(true)
    void (async () => {
      const row = await fetchMyTransactionReview(supabase, {
        transactionId: String(transactionId),
        reviewerId: userId,
      })
      if (!cancelled) {
        setMyTransactionReview(row)
        setMyTransactionReviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, transactionId, userId, transaction])

  useEffect(() => {
    if (!transaction || !userId || transaction.buyer_id !== userId) {
      return
    }
    void (async () => {
      const result = await autoCompleteMyPendingTransactionsWithPayout()
      if (result.completedCount > 0) {
        await loadTransactionAndPeer()
      }
    })()
  }, [transaction, userId, loadTransactionAndPeer])

  useEffect(() => {
    if (transaction?.status !== "approval_pending") {
      setShowDisputeReasonPicker(false)
      setApproveAgreementOpen(false)
    }
  }, [transaction?.status])

  const loadMessages = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!transactionId || !userId || !transaction) {
        return
      }
      const silent = options?.silent === true
      if (!silent) {
        setMessagesLoading(true)
      }
      const { data, error } = await supabase
        .from("messages")
        .select("id, transaction_id, sender_id, content, file_url, file_type, is_read, created_at")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true })

      if (error) {
        if (!silent) {
          setMessages([])
          setMessagesLoading(false)
        }
        return
      }

      setMessages((data ?? []) as MessageRow[])
      if (!silent) {
        setMessagesLoading(false)
      }
    },
    [supabase, transactionId, userId, transaction],
  )

  useEffect(() => {
    if (transaction) {
      void loadMessages()
    }
  }, [transaction, loadMessages])

  /** メッセージ送信者ごとに profiles を取得 */
  useEffect(() => {
    if (!messages.length) {
      return
    }
    const uniqueIds = [...new Set(messages.map((m) => m.sender_id))]
    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, custom_id")
        .in("id", uniqueIds)

      if (cancelled || error || !data) {
        return
      }

      setSenderProfiles((prev) => {
        const next = { ...prev }
        for (const row of data as SenderProfileRow[]) {
          next[row.id] = {
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            custom_id: row.custom_id,
          }
        }
        return next
      })
    })()

    return () => {
      cancelled = true
    }
  }, [messages, supabase])

  /**
   * messages で、現在の取引かつ相手からの未読を既読にする。
   * 条件: transaction_id が一致 / sender_id !== userId（相手）/ is_read === false → すべて true。
   */
  const markPeerMessagesAsRead = useCallback(async () => {
    if (!transactionId || !userId || !transaction) {
      return
    }
    const { data, error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("transaction_id", transactionId)
      .neq("sender_id", userId)
      .eq("is_read", false)
      .select()

    if (error) {
      console.error("【既読更新エラー】:", error)
      return
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.sender_id !== userId && m.is_read === false ? { ...m, is_read: true } : m,
      ),
    )
  }, [supabase, transactionId, userId, transaction])

  /** マウント後: 初回メッセージ取得完了時に既読更新 */
  useEffect(() => {
    if (!transaction || messagesLoading || !userId) {
      return
    }
    void markPeerMessagesAsRead()
  }, [transaction, messagesLoading, userId, markPeerMessagesAsRead])

  /** 画面フォーカス時: 既読更新のあと一覧を静かに再取得（送信者側の既読同期用） */
  useEffect(() => {
    if (!transaction || !userId) {
      return
    }
    const runMarkAndSync = () => {
      void (async () => {
        await markPeerMessagesAsRead()
        await loadMessages({ silent: true })
      })()
    }

    const onWindowFocus = () => {
      runMarkAndSync()
    }

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return
      }
      runMarkAndSync()
    }

    window.addEventListener("focus", onWindowFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onWindowFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [transaction, userId, markPeerMessagesAsRead, loadMessages])

  useEffect(() => {
    if (!transactionId || !transaction || !userId) {
      return
    }

    const handleRealtimePayload = (payload: { eventType: string; new: unknown; old: unknown }) => {
      if (payload.eventType === "INSERT") {
        const row = payload.new as MessageRow
        if (!row?.id) {
          return
        }
        setMessages((prev) => mergeMessageRow(prev, row))
        if (String(row.sender_id) !== String(userId)) {
          shouldAutoScrollRef.current = true
          void markPeerMessagesAsRead()
        }
        return
      }
      if (payload.eventType === "UPDATE") {
        const row = payload.new as MessageRow
        if (!row?.id) {
          return
        }
        setMessages((prev) => applyMessageUpdate(prev, row))
        return
      }
      if (payload.eventType === "DELETE") {
        const oldRow = payload.old as Partial<MessageRow> & { id?: unknown }
        const id = oldRow?.id
        if (id == null) {
          return
        }
        setMessages((prev) => prev.filter((m) => messageIdKey(m.id) !== messageIdKey(id)))
      }
    }

    const channel = supabase
      .channel(`messages:${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        handleRealtimePayload,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        handleRealtimePayload,
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        handleRealtimePayload,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[chat] messages realtime subscription failed", { transactionId, status })
        }
      })

    /** Realtime 未設定環境向け: 表示中は定期的に差分同期 */
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return
      }
      void loadMessages({ silent: true })
    }, 8000)

    return () => {
      window.clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [supabase, transactionId, transaction, userId, markPeerMessagesAsRead, loadMessages])

  useEffect(() => {
    if (!messagesEndRef.current) {
      return
    }
    if (!initialAutoScrollDoneRef.current || shouldAutoScrollRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      initialAutoScrollDoneRef.current = true
    }
  }, [messages, myTransactionReview, myTransactionReviewLoading, transaction?.status])

  const otherName = otherProfile?.display_name?.trim() || tPeer("fallback")
  const otherProfilePath = useMemo(() => {
    if (!transaction) {
      return null
    }
    const otherId = transaction.buyer_id === userId ? transaction.seller_id : transaction.buyer_id
    return buildProfilePath(String(otherId), otherProfile?.custom_id ?? null)
  }, [transaction, userId, otherProfile?.custom_id])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
        style: "currency",
        currency: "JPY",
        maximumFractionDigits: 0,
      }),
    [locale],
  )

  const formatDateTime = useCallback((iso: string | null) => {
    if (!iso) {
      return null
    }
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      return null
    }
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    const hh = String(d.getHours()).padStart(2, "0")
    const mi = String(d.getMinutes()).padStart(2, "0")
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`
  }, [])

  const statusLabel = useMemo(() => {
    switch (transaction?.status) {
      case "active":
        return tSidebar("statusActive")
      case "pending":
        return tSidebar("statusPending")
      case "in_progress":
        return tSidebar("statusInProgress")
      case "approval_pending":
        return tSidebar("statusApprovalPending")
      case "disputed":
        return tSidebar("statusDisputed")
      case "completed":
        return tSidebar("statusCompleted")
      case "canceled":
        return tSidebar("statusCanceled")
      case "refunded":
        return tSidebar("statusRefunded")
      default:
        return tSidebar("statusUnknown")
    }
  }, [transaction?.status, tSidebar])

  const statusBadgeClass = useMemo(() => {
    switch (transaction?.status) {
      case "approval_pending":
        return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-200"
      case "disputed":
        return "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-200"
      case "completed":
        return "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
      case "canceled":
      case "refunded":
        return "border-zinc-500/40 bg-zinc-500/15 text-zinc-700 dark:text-zinc-200"
      default:
        return "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-200"
    }
  }, [transaction?.status])

  const isSeller = Boolean(userId && transaction && transaction.seller_id === userId)
  const isBuyer = Boolean(userId && transaction && transaction.buyer_id === userId)
  const isRatingTerminal =
    transaction?.status === "completed" ||
    transaction?.status === "canceled" ||
    transaction?.status === "refunded"
  const isApprovalPending = transaction?.status === "approval_pending"
  const isDisputed = transaction?.status === "disputed"
  const isCompleted = transaction?.status === "completed"
  const isCanceledOrRefunded =
    transaction?.status === "canceled" || transaction?.status === "refunded"
  const isClosed = isCompleted || isDisputed || isCanceledOrRefunded
  const canSend = Boolean(transaction && !isClosed && userId && !isBannedUser)
  /** 申し立て内容（理由・詳細・証拠）は購入者本人のみ閲覧可 */
  const canViewDisputeSubmission = Boolean(
    userId && transaction && isDisputed && transaction.buyer_id === userId,
  )
  const insertMessage = useCallback(
    async (payload: {
      content: string
      file_url: string | null
      file_type: string | null
    }) => {
      if (!userId || !transactionId) {
        return { error: true as const }
      }
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          transaction_id: transactionId,
          sender_id: userId,
          content: payload.content,
          file_url: payload.file_url,
          file_type: payload.file_type,
          is_read: false,
        })
        .select("id, transaction_id, sender_id, content, file_url, file_type, is_read, created_at")
        .single()

      if (error || !inserted) {
        return { error: true as const }
      }
      setMessages((prev) => mergeMessageRow(prev, inserted as MessageRow))
      forceScrollToBottom()
      if (transaction && userId) {
        const recipientId =
          userId === String(transaction.buyer_id) ? transaction.seller_id : transaction.buyer_id
        void createTransactionNotification(supabase, {
          recipient_id: String(recipientId),
          type: NOTIFICATION_TYPE.message,
          // DB には常に JA 正規形を保存。表示時は notification-content-i18n.ts で
          // 受信者ロケールに応じて差し替える（送信者ロケールに依存させない）。
          content: lookupJaMessage("chat.notifications.newMessage"),
          reason: `transaction_id:${String(transactionId)}`,
        }).then(({ error: nErr }) => {
          if (nErr) {
            console.error("[chat] createTransactionNotification (message)", {
              message: nErr.message,
              code: nErr.code,
              details: nErr.details,
            })
          }
        })
        void fetch("/api/notifications/event-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "transaction_message",
            transactionId: String(transactionId),
          }),
        }).catch(() => {
          // メール通知失敗でチャット送信を失敗扱いにしない
        })
      }
      return { error: false as const }
    },
    [supabase, transactionId, userId, transaction, forceScrollToBottom],
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked || !canSend || sending || linkSending || isClosed) {
      return
    }
    const validation = validateChatAttachmentFile(picked)
    if (!validation.ok) {
      // バリデーション結果の `code` を使って locale 別の文言を解決する。
      window.alert(tErr(validation.code))
      return
    }
    setSendError(null)
    setFile(picked)
  }

  const clearPendingFile = () => {
    setFile(null)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !transactionId || !canSend || sending || linkSending || isClosed) {
      return
    }
    const trimmed = text.trim()
    if (!trimmed && !file) {
      return
    }

    setSendError(null)
    setSending(true)

    let fileUrl: string | null = null
    let mediaType: string | null = null

    let messageContent = trimmed

    if (file) {
      const validation = validateChatAttachmentFile(file)
      if (!validation.ok) {
        window.alert(tErr(validation.code))
        setSending(false)
        return
      }
      const path = buildChatFileUploadPath(String(transactionId), file)
      const { data: upData, error: upErr } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      })
      if (upErr || !upData?.path) {
        setSendError(tErr("fileUploadFailed"))
        setSending(false)
        return
      }
      fileUrl = upData.path
      mediaType = storedFileTypeForUpload(file, validation.kind)
      messageContent = buildChatFileMessageContent(trimmed, { name: file.name, size: file.size })
    }

    const ok = await insertMessage({
      content: messageContent,
      file_url: fileUrl,
      file_type: mediaType,
    })

    setSending(false)

    if (ok.error) {
      setSendError(fileUrl ? tErr("messageSendFailed") : tErr("sendFailedFallback"))
      return
    }

    setText("")
    setFile(null)
  }

  const handleApplyCompletion = async () => {
    if (
      !userId ||
      !transactionId ||
      !isSeller ||
      completing ||
      !transaction ||
      !SELLER_APPLY_COMPLETION_STATUSES.has(transaction.status)
    ) {
      console.warn("[tx-apply] skipped", {
        userId,
        transactionId,
        isSeller,
        completing,
        transactionStatus: transaction?.status ?? null,
      })
      return
    }
    setNotice(null)
    setCompleteError(null)
    setCompleting(true)
    const appliedAt = new Date().toISOString()

    try {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          status: "approval_pending",
          applied_at: appliedAt,
        })
        .eq("id", transactionId)
        .eq("seller_id", userId)
        .in("status", ["active", "pending", "in_progress"])
        .select("id, status")
        .maybeSingle()

      if (error || !data || (data as { status?: string }).status !== "approval_pending") {
        const { data: latestRow } = await supabase
          .from("transactions")
          .select("id, buyer_id, seller_id, status, applied_at, completed_at, auto_complete_at")
          .eq("id", transactionId)
          .maybeSingle()
        const latestStatus = (latestRow as { status?: string } | null)?.status ?? null
        if (latestStatus === "completed") {
          setRequestAgreementOpen(false)
          setNotice({ variant: "success", message: tSucc("alreadyCompleted") })
          await loadTransactionAndPeer()
          return
        }
        console.error("[tx-apply] update verification failed", {
          transactionId,
          userId,
          clientStatus: transaction?.status ?? null,
          expectedStatus: "approval_pending",
          supabaseError: error
            ? { message: error.message, code: error.code, details: error.details, hint: error.hint }
            : null,
          updateResult: data ?? null,
          latestRow: latestRow ?? null,
        })
        setNotice({
          variant: "error",
          message: tErr("txUpdateFailed"),
        })
        return
      }

      setRequestAgreementOpen(false)
      setNotice({ variant: "success", message: tSucc("applyRequested") })
      if (userId) {
        void createTransactionNotification(supabase, {
          recipient_id: String(transaction.buyer_id),
          type: NOTIFICATION_TYPE.completion_request,
          // DB には常に JA 正規形を保存。表示時翻訳で受信者ロケールに応じて差し替える。
          content: lookupJaMessage("chat.notifications.applyForApproval"),
          reason: `transaction_id:${String(transactionId)}`,
        }).then(({ error: nErr }) => {
          if (nErr) {
            console.error("[tx-apply] createTransactionNotification", {
              message: nErr.message,
              code: nErr.code,
              details: nErr.details,
            })
          }
        })
        void fetch("/api/notifications/event-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "completion_requested",
            transactionId: String(transactionId),
          }),
        }).catch(() => {
          // メール通知失敗で完了申請を失敗扱いにしない
        })
      }
      await loadTransactionAndPeer()
    } catch (error) {
      console.error("[tx-apply] unexpected exception", {
        transactionId,
        userId,
        error: extractSupabaseErrorDetails(error),
      })
      setNotice({
          variant: "error",
          message: tErr("txUpdateFailed"),
        })
    } finally {
      setCompleting(false)
    }
  }

  const handleApproveCompletion = async () => {
    if (!transactionId || completing) {
      console.warn("[tx-complete] skipped", {
        transactionId,
        completing,
      })
      return
    }
    if (!userId) {
      setCompleteError(tErr("loginInfoMissing"))
      return
    }
    setCompleteError(null)
    setCompleting(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error("セッション取得失敗")
        throw new Error("AUTH_REQUIRED")
      }
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession()
      if (refreshError || !refreshedSession) {
        console.error("セッション更新失敗", {
          error: extractSupabaseErrorDetails(refreshError),
        })
        throw new Error("AUTH_REQUIRED")
      }

      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id ?? null
      if (!authUserId) {
        setCompleteError(tErr("loginInfoMissing"))
        return
      }

      await completeTransactionWithPayout(String(transactionId), "standard")

      const { data: messages, error: dbError } = await supabase
        .from("messages")
        .select("file_url")
        .eq("transaction_id", transactionId)
        .not("file_url", "is", null)

      if (dbError) {
        console.error("DB取得エラー:", dbError)
        setCompleteError(tErr("completeChatFileFetchFailed"))
        return
      }

      if (messages && messages.length > 0) {
        const extractedFileNames = (messages as { file_url: string }[]).map((m) => {
          const url = m.file_url
          const urlParts = url.split("/")
          return urlParts[urlParts.length - 1] ?? url
        })
        const pathsToRemove = [...new Set(extractedFileNames)]

        if (pathsToRemove.length > 0) {
          const fullPaths = pathsToRemove.map((name) => `${transactionId}/${name}`)

          const { error: removeError } = await supabase.storage
            .from(CHAT_MEDIA_BUCKET)
            .remove(fullPaths)

          if (removeError) {
            console.error("削除エラー:", removeError)
          }
        }
      }
      setApproveAgreementOpen(false)
      await loadTransactionAndPeer()
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        setNotice({ variant: "error", message: tErr("sessionExpired") })
        router.push("/login")
        return
      }
      safeClientLogError("[tx-complete] error")
      setCompleteError(tErr("approveGenericFailed"))
    } finally {
      setCompleting(false)
    }
  }

  const handleDisputeSubmit = async () => {
    if (!userId || !transactionId || !isBuyer || completing || !isApprovalPending) {
      return
    }
    const reason = disputeReason.trim()
    if (!reason) {
      setCompleteError(tErr("disputeReasonRequired"))
      return
    }
    if (disputedEvidenceUploading) {
      setCompleteError(tErr("waitEvidenceUpload"))
      return
    }
    setCompleteError(null)
    setNotice(null)
    setCompleting(true)
    const disputedAt = new Date().toISOString()
    let uploadedEvidencePath: string | null = null

    if (disputeEvidenceFile) {
      setDisputedEvidenceUploading(true)
      const uploadPath = buildDisputeEvidenceUploadPath(userId, transactionId, disputeEvidenceFile)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(DISPUTE_EVIDENCE_BUCKET)
        .upload(uploadPath, disputeEvidenceFile, {
          contentType: disputeEvidenceFile.type || undefined,
          upsert: true,
        })
      setDisputedEvidenceUploading(false)
      if (uploadError || !uploadData?.path) {
        logDisputeEvidenceUploadError(
          "storage.upload 失敗（error または path 未取得）",
          DISPUTE_EVIDENCE_BUCKET,
          uploadPath,
          disputeEvidenceFile,
          uploadError ?? { message: "uploadData.path が空", uploadData },
        )
        setCompleting(false)
        setCompleteError(tErr("evidenceUploadFailed"))
        if (isAdmin) {
          setNotice({
            variant: "error",
            message: tErr("evidenceUploadFailedTxNote"),
          })
        }
        return
      }
      uploadedEvidencePath = uploadData.path
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({
        status: "disputed",
        dispute_status: "open",
        disputed_reason: reason,
        disputed_reason_detail: disputed_reason_detail.trim() || null,
        disputed_evidence_url: uploadedEvidencePath,
        disputed_at: disputedAt,
        auto_complete_at: null,
      })
      .eq("id", transactionId)
      .eq("buyer_id", userId)
      .eq("status", "approval_pending")
      .select("id, status")
      .maybeSingle()
    setCompleting(false)
    if (error || !data || (data as { status?: string }).status !== "disputed") {
      console.error("異議申し立ての更新確認に失敗:", { error, data })
      setCompleteError(tErr("disputeSubmitFailed"))
      return
    }
    setShowDisputeReasonPicker(false)
    setDisputeEvidenceFile(null)
    try {
      const inAppRes = await fetch("/api/notifications/dispute-inapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: String(transactionId) }),
        keepalive: true,
      })
      if (!inAppRes.ok) {
        console.error("[dispute] dispute-inapp failed", await inAppRes.text().catch(() => ""))
        setNotice({
          variant: "error",
          message: tErr("disputeRecordedNoticeMissing"),
        })
      }
    } catch (e) {
      console.error("[dispute] dispute-inapp", e)
      setNotice({
        variant: "error",
        message: tErr("disputeRecordedNoticeMissing"),
      })
    }
    try {
      await fetch("/api/notifications/dispute-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: String(transactionId),
          reason,
        }),
        keepalive: true,
      })
    } catch {
      // Discord 通知失敗で異議申し立て自体は失敗扱いにしない
    }
    await loadTransactionAndPeer()
  }

  const handleDisputeEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked) {
      return
    }
    if (!picked.type.startsWith("image/")) {
      setCompleteError(tErr("evidenceMustBeImage"))
      return
    }
    if (picked.size > MAX_DISPUTE_EVIDENCE_BYTES) {
      setCompleteError(tErr("evidenceTooLarge"))
      return
    }

    setCompleteError(null)
    setDisputeEvidenceFile(picked)
  }

  const handleDisputeEvidenceClear = () => {
    setDisputeEvidenceFile(null)
    if (disputeEvidenceInputRef.current) {
      disputeEvidenceInputRef.current.value = ""
    }
  }

  const handleLinkIntegrationConfirm = async (payload: LinkMessagePayload) => {
    if (!userId || !transactionId || !canSend || linkSending) {
      return
    }
    if (!isSeller && payload.kind !== "youtube") {
      return
    }
    setSendError(null)
    setLinkSending(true)
    const ok = await insertMessage({
      content: serializeLinkPayload(payload),
      file_url: null,
      file_type: CHAT_LINK_FILE_TYPE,
    })
    setLinkSending(false)
    if (ok.error) {
      setSendError(tErr("linkSendFailed"))
      return
    }
    setLinkModalOpen(false)
  }

  if (authLoading || !transactionId) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    const redirectTo = transactionId ? `/login?redirect=${encodeURIComponent(chatPathWithQuery)}` : "/login"
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <p className="text-center text-sm text-muted-foreground">{t("loginRequired")}</p>
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-500"
          onClick={() => router.replace(redirectTo)}
        >
          {t("loginCta")}
        </Button>
      </div>
    )
  }

  if (txLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <span className="ml-2 text-sm">{t("txLoading")}</span>
      </div>
    )
  }

  if (loadError || !transaction) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl">
          <Button
            type="button"
            variant="outline"
            className="mb-8 border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
            onClick={handleHeaderBack}
          >
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("backLabel")}
            </span>
          </Button>
          <p className="text-center text-red-400">{loadError ?? t("openFailedFallback")}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background text-foreground lg:flex-row"
      onPointerDownCapture={dismissDisputePickerIfOutside}
    >
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <aside className="hidden lg:flex lg:h-full lg:w-80 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:bg-card/40 xl:w-96">
        <div className="border-b border-border px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleHeaderBack}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("backLabel")}
          </Button>
          <h2 className="mt-2 text-base font-semibold text-foreground">{tSidebar("overviewHeading")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{tHeader("txChat")}</p>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-5 py-5">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tSidebar("peerHeading")}
            </p>
            <div className="flex items-center gap-3">
              {otherProfilePath ? (
                <Link href={otherProfilePath} className="shrink-0" aria-label={tSidebar("viewProfile")}>
                  <ProfileAvatar
                    avatarUrl={otherProfile?.avatar_url ?? null}
                    alt={otherName}
                    className="h-14 w-14 border border-border"
                    sizes="56px"
                  />
                </Link>
              ) : (
                <ProfileAvatar
                  avatarUrl={otherProfile?.avatar_url ?? null}
                  alt={otherName}
                  className="h-14 w-14 border border-border"
                  sizes="56px"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">{otherName}</p>
                {otherProfilePath ? (
                  <Link
                    href={otherProfilePath}
                    className="text-xs text-red-500 hover:text-red-400 hover:underline"
                  >
                    {tSidebar("viewProfile")}
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("skillLabel")}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                {skillTitle ?? tSidebar("skillLoading")}
              </p>
              {transaction.skill_id ? (
                <Link
                  href={`/skills/${transaction.skill_id}`}
                  className="mt-1 inline-block text-xs text-red-500 hover:text-red-400 hover:underline"
                >
                  {tSidebar("openSkill")}
                </Link>
              ) : null}
            </div>

            <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("priceLabel")}
              </p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {currencyFormatter.format(Number(transaction.price ?? 0))}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("statusLabel")}
              </p>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusBadgeClass)}>
                {statusLabel}
              </span>
            </div>
          </section>

          {transaction.applied_at || transaction.completed_at || transaction.disputed_at ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("timelineHeading")}
              </p>
              <dl className="space-y-1.5 text-xs">
                {transaction.applied_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{tSidebar("appliedAt")}</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      {formatDateTime(transaction.applied_at)}
                    </dd>
                  </div>
                ) : null}
                {transaction.applied_at && isApprovalPending ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{tSidebar("autoCompleteAt")}</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      {formatAppliedDeadline(transaction.applied_at)}
                    </dd>
                  </div>
                ) : null}
                {transaction.disputed_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{tSidebar("disputedAt")}</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      {formatDateTime(transaction.disputed_at)}
                    </dd>
                  </div>
                ) : null}
                {transaction.completed_at ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{tSidebar("completedAt")}</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      {formatDateTime(transaction.completed_at)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {(isSeller && !isDisputed) || (isBuyer && isApprovalPending) ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("actionsHeading")}
              </p>
              {isSeller && !isDisputed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    isClosed ||
                    completing ||
                    isApprovalPending ||
                    !SELLER_APPLY_COMPLETION_STATUSES.has(transaction.status)
                  }
                  onClick={() => setRequestAgreementOpen(true)}
                  className="w-full justify-center border-amber-600/50 bg-amber-50 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
                >
                  {completing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tAct("processing")}
                    </>
                  ) : isApprovalPending ? (
                    tAct("applyPending")
                  ) : isCanceledOrRefunded ? (
                    tAct("applyCanceled")
                  ) : isCompleted ? (
                    tAct("applyClosed")
                  ) : (
                    tAct("applyCta")
                  )}
                </Button>
              ) : null}
              {isBuyer && isApprovalPending ? (
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-200/90">
                    {tApprov("intro")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={completing}
                    onClick={() => setApproveAgreementOpen(true)}
                    className="w-full justify-center bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {tAct("approveCompletion")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={completing}
                    onClick={() => setShowDisputeReasonPicker((prev) => !prev)}
                    className="w-full justify-center border-red-500/50 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/60"
                  >
                    {tAct("openDispute")}
                  </Button>
                </div>
              ) : null}
              {completeError && !showDisputeReasonPicker ? (
                <p className="mt-2 text-xs text-red-400">{completeError}</p>
              ) : null}
            </section>
          ) : null}

          {isBannedUser || isCanceledOrRefunded || isCompleted || isDisputed ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tSidebar("noticesHeading")}
              </p>
              {isBannedUser ? (
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">{tBanner("banned")}</p>
              ) : isCanceledOrRefunded ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{tBanner("canceled")}</p>
              ) : isCompleted ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{tBanner("closed")}</p>
              ) : isDisputed ? (
                <div className="space-y-2">
                  <div className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950 dark:bg-amber-950/35 dark:text-amber-50/95">
                    {isBuyer
                      ? tBanner("disputedBuyer")
                      : isSeller
                        ? tBanner("disputedSeller")
                        : tBanner("disputedBuyer")}
                  </div>
                  {canViewDisputeSubmission ? (
                    <div className="space-y-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      {transaction.disputed_reason ? (
                        <p>
                          <span className="text-muted-foreground">{tDispSub("reasonLabel")}</span>{" "}
                          {(() => {
                            const key = DISPUTE_REASON_VALUE_TO_KEY[transaction.disputed_reason ?? ""]
                            return key ? tDispReasons(key) : transaction.disputed_reason
                          })()}
                        </p>
                      ) : null}
                      {transaction.disputed_reason_detail ? (
                        <p className="whitespace-pre-wrap">
                          <span className="text-muted-foreground">{tDispSub("detailLabel")}</span>{" "}
                          {transaction.disputed_reason_detail}
                        </p>
                      ) : null}
                      {transaction.disputed_evidence_url?.trim() ? (
                        <DisputeEvidenceImage
                          pathOrUrl={transaction.disputed_evidence_url}
                          alt={tDispSub("evidenceAlt")}
                          className="mt-1"
                          chatThumbnail
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="mt-auto border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>{tSidebar("transactionIdLabel")}: </span>
            <span className="font-mono text-foreground">{String(transaction.id)}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={handleHeaderBack}
            >
              <span aria-label={tHeader("backAria")}>
                <ArrowLeft className="h-5 w-5" />
              </span>
            </Button>
            <ProfileAvatar
              avatarUrl={otherProfile?.avatar_url ?? null}
              alt={otherName}
              className="h-10 w-10 border border-border"
              sizes="40px"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{otherName}</p>
              <p className="text-xs text-muted-foreground">{tHeader("txChat")}</p>
            </div>
          </div>

          {isSeller ? (
            <div className="flex flex-wrap items-center gap-2 pl-[52px]">
              {!isDisputed ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    isClosed ||
                    completing ||
                    isApprovalPending ||
                    !SELLER_APPLY_COMPLETION_STATUSES.has(transaction.status)
                  }
                  onClick={() => setRequestAgreementOpen(true)}
                  className="border-amber-600/50 bg-amber-50 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-600/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
                >
                  {completing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tAct("processing")}
                    </>
                  ) : isApprovalPending ? (
                    tAct("applyPending")
                  ) : isCanceledOrRefunded ? (
                    tAct("applyCanceled")
                  ) : isCompleted ? (
                    tAct("applyClosed")
                  ) : (
                    tAct("applyCta")
                  )}
                </Button>
              ) : null}
              {completeError ? <span className="text-xs text-red-400">{completeError}</span> : null}
            </div>
          ) : null}

          {isBuyer && isApprovalPending ? (
            <div ref={disputeBuyerActionsRef} className="flex flex-col gap-2 pl-[52px]">
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                {tApprov("intro")}
              </p>
              {transaction.applied_at ? (
                <p className="text-[11px] text-muted-foreground">
                  {tApprov("autoComplete", { deadline: formatAppliedDeadline(transaction.applied_at) ?? "" })}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={completing}
                  onClick={() => setApproveAgreementOpen(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {tAct("approveCompletion")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={completing}
                  onClick={() => setShowDisputeReasonPicker((prev) => !prev)}
                  className="border-red-500/50 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-950/60"
                >
                  {tAct("openDispute")}
                </Button>
              </div>
              {completeError && !showDisputeReasonPicker ? (
                <span className="text-xs text-red-400">{completeError}</span>
              ) : null}
            </div>
          ) : null}

          {isBannedUser ? (
            <p className="pl-[52px] text-xs text-amber-800 dark:text-amber-200">
              {tBanner("banned")}
            </p>
          ) : isCanceledOrRefunded ? (
            <p className="pl-[52px] text-xs text-muted-foreground">
              {tBanner("canceled")}
            </p>
          ) : isCompleted ? (
            <p className="pl-[52px] text-xs text-muted-foreground">{tBanner("closed")}</p>
          ) : isDisputed ? (
            <div className="pl-[52px]">
              <div className="max-w-full rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950 dark:bg-amber-950/35 dark:text-amber-50/95">
                {isBuyer
                  ? tBanner("disputedBuyer")
                  : isSeller
                    ? tBanner("disputedSeller")
                    : tBanner("disputedBuyer")}
              </div>
              {canViewDisputeSubmission ? (
                <div className="mt-2 max-w-full space-y-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {transaction.disputed_reason ? (
                    <p>
                      <span className="text-muted-foreground">{tDispSub("reasonLabel")}</span>{" "}
                      {(() => {
                        const key = DISPUTE_REASON_VALUE_TO_KEY[transaction.disputed_reason ?? ""]
                        return key ? tDispReasons(key) : transaction.disputed_reason
                      })()}
                    </p>
                  ) : null}
                  {transaction.disputed_reason_detail ? (
                    <p className="whitespace-pre-wrap">
                      <span className="text-muted-foreground">{tDispSub("detailLabel")}</span> {transaction.disputed_reason_detail}
                    </p>
                  ) : null}
                  {transaction.disputed_evidence_url?.trim() ? (
                    <DisputeEvidenceImage
                      pathOrUrl={transaction.disputed_evidence_url}
                      alt={tDispSub("evidenceAlt")}
                      className="mt-1"
                      chatThumbnail
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <header className="sticky top-0 z-10 hidden border-b border-border bg-card/95 backdrop-blur lg:flex lg:items-center lg:justify-between lg:gap-4 lg:px-6 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          {otherProfilePath ? (
            <Link href={otherProfilePath} className="shrink-0" aria-label={tSidebar("viewProfile")}>
              <ProfileAvatar
                avatarUrl={otherProfile?.avatar_url ?? null}
                alt={otherName}
                className="h-10 w-10 border border-border"
                sizes="40px"
              />
            </Link>
          ) : (
            <ProfileAvatar
              avatarUrl={otherProfile?.avatar_url ?? null}
              alt={otherName}
              className="h-10 w-10 border border-border"
              sizes="40px"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{otherName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {skillTitle ?? tHeader("txChat")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs tabular-nums text-muted-foreground xl:inline">
            {currencyFormatter.format(Number(transaction.price ?? 0))}
          </span>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusBadgeClass)}>
            {statusLabel}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={handleMessageListScroll}
        className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 lg:max-w-3xl lg:px-6 xl:max-w-4xl"
      >
        {messagesLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          </div>
        ) : (
          <>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tList("empty")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId
            const prof = senderProfiles[m.sender_id]
            const label = mine ? tMsg("selfLabel") : prof?.display_name?.trim() || tMsg("anonymousUser")
            const senderProfilePath = buildProfilePath(m.sender_id, prof?.custom_id ?? null)
            const linkPayload =
              m.file_type === CHAT_LINK_FILE_TYPE ? parseLinkMessageContent(m.content) : null
            const youtubeFromFileType =
              m.file_type === CHAT_YOUTUBE_FILE_TYPE ? normalizeYoutubeUrlForPlayer(m.content) : null
            const plainRichYoutubeUrl =
              m.file_type !== CHAT_LINK_FILE_TYPE &&
              m.file_type !== CHAT_YOUTUBE_FILE_TYPE &&
              !m.file_url
                ? extractYoutubeUrlFromPlainContent(m.content)
                : null
            const isYoutubeMessage =
              (linkPayload?.kind === "youtube") || Boolean(youtubeFromFileType) || Boolean(plainRichYoutubeUrl)
            const bubbleWidthClass = isYoutubeMessage ? "w-full max-w-[400px]" : "max-w-[85%]"
            const fileMeta = m.file_url ? parseChatFileMessageContent(m.content).meta : null
            const visibleText = messageDisplayText(m)

            const bubble = (
              <div
                className={cn(
                  "rounded-2xl text-sm leading-relaxed",
                  isYoutubeMessage ? "w-full" : "",
                  isYoutubeMessage ? "p-2" : "px-3 py-2",
                  mine
                    ? "bg-red-600 text-white"
                    : "border border-border bg-muted text-foreground",
                )}
              >
                {linkPayload ? (
                  <ChatLinkMessageCard payload={linkPayload} mine={mine} />
                ) : m.file_type === CHAT_LINK_FILE_TYPE ? (
                  <p className={cn("text-xs", mine ? "text-red-100/95" : "text-amber-200/90")}>
                    {tMsg("linkLoadFailed")}
                  </p>
                ) : m.file_type === CHAT_YOUTUBE_FILE_TYPE ? (
                  youtubeFromFileType ? (
                    <ChatYoutubeRich url={youtubeFromFileType} mine={mine} />
                  ) : (
                    <p className={cn("text-xs", mine ? "text-red-100/95" : "text-amber-200/90")}>
                      {tMsg("youtubeLoadFailed")}
                    </p>
                  )
                ) : plainRichYoutubeUrl ? (
                  <ChatYoutubeRich url={plainRichYoutubeUrl} mine={mine} />
                ) : (
                  <div className="flex flex-col gap-2">
                    {m.file_url ? (
                      <ChatMediaSigned
                        supabase={supabase}
                        path={m.file_url}
                        fileType={m.file_type}
                        fileName={fileMeta?.name}
                        fileSizeBytes={fileMeta?.size ?? null}
                        mine={mine}
                        onExpand={(media) => setExpandedMedia(media)}
                      />
                    ) : null}
                    {visibleText ? (
                      <p className="whitespace-pre-wrap break-words">{visibleText}</p>
                    ) : null}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-1 flex items-center gap-2 tabular-nums",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  <p className={cn("text-[11px]", mine ? "text-red-100/90" : "text-muted-foreground")}>
                    {formatMessageTime(m.created_at)}
                  </p>
                  {mine ? (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        m.is_read ? "text-red-100/85" : "text-amber-200",
                      )}
                    >
                      {m.is_read ? tMsg("readMark") : tMsg("unreadMark")}
                    </span>
                  ) : null}
                </div>
              </div>
            )

            if (mine) {
              return (
                <div key={messageIdKey(m.id)} className="flex w-full justify-end">
                  <div className={cn("flex min-w-0 flex-col items-end gap-1", bubbleWidthClass)}>
                    <p className="max-w-full truncate px-1 text-left text-xs text-muted-foreground">{label}</p>
                    {bubble}
                  </div>
                </div>
              )
            }

            return (
              <div key={messageIdKey(m.id)} className="flex w-full items-start justify-start gap-2">
                <Link
                  href={senderProfilePath}
                  className="shrink-0"
                  aria-label={tMsg("viewProfileAria", { name: label })}
                >
                  <ProfileAvatar
                    avatarUrl={prof?.avatar_url ?? null}
                    alt={label}
                    className="h-9 w-9 border border-border"
                    sizes="36px"
                  />
                </Link>
                <div
                  className={cn(
                    "min-w-0",
                    isYoutubeMessage ? "flex-1 max-w-[400px]" : "max-w-[calc(100%-2.75rem)]",
                  )}
                >
                  <p className="mb-1 truncate text-xs text-muted-foreground">{label}</p>
                  {bubble}
                </div>
              </div>
            )
          })
        )}
        {isRatingTerminal && userId && transaction && (isBuyer || isSeller) ? (
          <div className="mt-2 flex w-full justify-center">
            <TransactionReviewCard
              transactionId={String(transactionId)}
              userId={userId}
              revieweeId={isBuyer ? String(transaction.seller_id) : String(transaction.buyer_id)}
              peerNoun={isBuyer ? tMsg("peerNounSeller") : tMsg("peerNounBuyer")}
              initialReview={myTransactionReview}
              reviewLoading={myTransactionReviewLoading}
              onReviewSaved={(row) => {
                setMyTransactionReview(row)
                setNotice({ variant: "success", message: tSucc("reviewSent") })
                void loadTransactionAndPeer()
                router.refresh()
              }}
              onError={(message) => {
                setNotice({ variant: "error", message })
              }}
            />
          </div>
        ) : null}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="shrink-0 border-t border-border bg-card/95 backdrop-blur">
        <form
          ref={composerFormRef}
          onSubmit={(e) => void handleSend(e)}
          className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 lg:max-w-3xl lg:px-6 xl:max-w-4xl"
        >
          {file ? (
            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40 p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={sending}
                className="absolute right-1 top-1 z-10 h-8 w-8 rounded-full border border-border bg-background/90 text-foreground shadow-sm hover:border-primary hover:text-primary-readable"
                aria-label={tComp("removeAttachment")}
                onClick={clearPendingFile}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex min-h-[5rem] max-h-48 items-center justify-center overflow-hidden rounded-md bg-muted/60 p-2">
                {previewUrl && classifyChatFile(file) === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ローカルプレビュー用 blob URL
                  <img src={previewUrl} alt="" className="max-h-44 w-full object-contain" />
                ) : previewUrl && classifyChatFile(file) === "video" ? (
                  <video src={previewUrl} controls className="max-h-44 w-full object-contain" preload="metadata" />
                ) : file ? (
                  <ChatAttachmentFileCard
                    fileName={file.name}
                    fileSizeBytes={file.size}
                    downloadUrl={null}
                    pending
                    className="border-0 bg-transparent"
                  />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" aria-hidden />
                )}
              </div>
              <p className="mt-1 truncate text-center text-[11px] text-muted-foreground">{file.name}</p>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={CHAT_FILE_INPUT_ACCEPT}
              className="hidden"
              disabled={!canSend || sending || linkSending}
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canSend || sending || linkSending}
              className="mb-0.5 shrink-0 border-border bg-background text-foreground hover:border-primary hover:bg-muted"
              aria-label={tComp("attachFile")}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {isSeller || isBuyer ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!canSend || sending || linkSending}
              className="mb-0.5 shrink-0 border-border bg-background text-foreground hover:border-primary hover:bg-muted"
              aria-label={
                isSeller
                  ? tComp("externalToolSeller", { tools: ALLOWED_EXTERNAL_TOOLS_SLASH })
                  : tComp("externalToolBuyer")
              }
                onClick={() => setLinkModalOpen(true)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            ) : null}
            <ChatComposerTextarea
              value={text}
              onChange={setText}
              placeholder={canSend ? tComp("placeholder") : tComp("disabledPlaceholder")}
              disabled={!canSend || sending || linkSending}
              maxLength={8000}
              onSubmit={() => composerFormRef.current?.requestSubmit()}
            />
            <Button
              type="submit"
              disabled={!canSend || sending || linkSending || (!text.trim() && !file)}
              className="mb-0.5 shrink-0 bg-red-600 text-white hover:bg-red-500"
              aria-label={tComp("sendAria")}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {isBannedUser ? (
              tComp("bannedNote")
            ) : (
              <>
                {tComp("filePart1")}
                <strong className="font-medium text-muted-foreground">{tComp("fileLimit")}</strong>
                {tComp("filePart2")}
                <br />
                {isSeller
                  ? tComp("linkSeller", { tools: ALLOWED_EXTERNAL_TOOLS_SLASH })
                  : isBuyer
                    ? tComp("linkBuyer")
                    : tComp("linkGeneric")}
                <span className="hidden md:inline">
                  <br />
                  {tComp("keyboardHint")}
                </span>
              </>
            )}
          </p>
        </form>
        {sendError ? (
          <p className="mx-auto max-w-2xl px-4 pb-2 text-center text-xs text-red-400 lg:max-w-3xl lg:px-6 xl:max-w-4xl">
            {sendError}
          </p>
        ) : null}
      </footer>

      {showDisputeReasonPicker && isBuyer && isApprovalPending ? (
        <>
          <div className="absolute inset-0 z-20 bg-black/50" aria-hidden />
          <div
            ref={disputeFormPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispute-form-title"
            className="absolute inset-x-0 bottom-0 z-30 flex max-h-[min(85dvh,calc(100%-0.5rem))] flex-col rounded-t-2xl border border-border border-b-0 bg-card shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-start justify-between gap-2">
                <h2 id="dispute-form-title" className="text-base font-semibold text-foreground">
                  {tDispForm("title")}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={tDispForm("closeAria")}
                  disabled={completing}
                  onClick={() => setShowDisputeReasonPicker(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tDispForm("intro")}
              </p>
              {completeError ? (
                <p className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {completeError}
                </p>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="dispute-reason" className="text-xs font-medium text-muted-foreground">
                  {tDispForm("reasonLabel")}
                </label>
                <select
                  id="dispute-reason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  disabled={completing}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
                >
                  {DISPUTE_REASON_OPTIONS.map((opt) => {
                    const key = DISPUTE_REASON_VALUE_TO_KEY[opt]
                    return (
                      <option key={opt} value={opt}>
                        {key ? tDispReasons(key) : opt}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="dispute-detail" className="text-xs font-medium text-muted-foreground">
                  {tDispForm("detailLabel")}
                </label>
                <textarea
                  id="dispute-detail"
                  value={disputed_reason_detail}
                  onChange={(e) => setDisputedReasonDetail(e.target.value)}
                  disabled={completing}
                  rows={4}
                  maxLength={2000}
                  placeholder={tDispForm("detailPlaceholder")}
                  className="min-h-[5rem] resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">{tDispForm("evidenceLabel")}</span>
                <input
                  ref={disputeEvidenceInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={completing}
                  onChange={handleDisputeEvidenceSelect}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={completing}
                    onClick={() => disputeEvidenceInputRef.current?.click()}
                    className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
                  >
                    {tDispForm("selectImage")}
                  </Button>
                  {disputeEvidenceFile ? (
                    <>
                      <span className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-xs">
                        {disputeEvidenceFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={completing}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleDisputeEvidenceClear}
                      >
                        {tDispForm("clearImage")}
                      </Button>
                    </>
                  ) : null}
                </div>
                {disputeEvidencePreviewUrl ? (
                  <div className="relative mt-1 overflow-hidden rounded-md border border-border bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element -- ローカルプレビュー用 blob URL */}
                    <img
                      src={disputeEvidencePreviewUrl}
                      alt=""
                      className="max-h-40 w-full object-contain"
                    />
                  </div>
                ) : null}
                <p className="text-[11px] text-muted-foreground">{tDispForm("imageNote")}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={completing}
                  onClick={() => setShowDisputeReasonPicker(false)}
                  className="border-border bg-background text-muted-foreground"
                >
                  {tDispForm("cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={completing || disputedEvidenceUploading}
                  onClick={() => void handleDisputeSubmit()}
                  className="bg-red-600 text-white hover:bg-red-500"
                >
                  {completing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tDispForm("submitting")}
                    </>
                  ) : (
                    tDispForm("submit")
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      </div>
      </div>

      {isSeller || isBuyer ? (
        <ChatLinkIntegrationModal
          open={linkModalOpen}
          onClose={() => {
            if (!linkSending) {
              setLinkModalOpen(false)
            }
          }}
          busy={linkSending}
          allowZoom={isSeller}
          onConfirm={(payload) => void handleLinkIntegrationConfirm(payload)}
        />
      ) : null}
      {requestAgreementOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={() => {
            if (!completing) {
              setRequestAgreementOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-agreement-title"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="request-agreement-title" className="text-lg font-bold text-foreground">
              {tReqAgr("title")}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                {tReqAgr("body1")}
              </p>
              <p>
                {tReqAgr("body2")}
              </p>
              <p>
                {tReqAgr("body3")}
              </p>
              <p>{tReqAgr("confirm")}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={completing}
                className="border-border bg-background text-foreground hover:bg-muted"
                onClick={() => setRequestAgreementOpen(false)}
              >
                {tReqAgr("cancel")}
              </Button>
              <Button
                type="button"
                disabled={completing}
                className="bg-amber-600 text-white hover:bg-amber-500"
                onClick={() => void handleApplyCompletion()}
              >
                {completing ? tReqAgr("submitting") : tReqAgr("submit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {approveAgreementOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          onClick={() => {
            if (!completing) {
              setApproveAgreementOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-agreement-title"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="approve-agreement-title" className="text-lg font-bold text-foreground">
              {tAppAgr("title")}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                {tAppAgr("body1")}
              </p>
              <p>{tAppAgr("body2")}</p>
              <p>
                {tAppAgr("body3")}
              </p>
              <p>{tAppAgr("body4")}</p>
              <p>{tAppAgr("confirm")}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={completing}
                className="border-border bg-background text-foreground hover:bg-muted"
                onClick={() => setApproveAgreementOpen(false)}
              >
                {tAppAgr("cancel")}
              </Button>
              <Button
                type="button"
                disabled={completing}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => void handleApproveCompletion()}
              >
                {completing ? tAppAgr("submitting") : tAppAgr("submit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {expandedMedia ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpandedMedia(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {expandedMedia.type === "image" ? (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-full bg-black/60 px-4 text-sm font-medium text-white hover:bg-black/80"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleSaveExpandedImage()
                }}
              >
                {tViewer("save")}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={tViewer("closeAria")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation()
                setExpandedMedia(null)
              }}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
            {expandedMedia.type === "video" ? (
              <video
                src={expandedMedia.url}
                controls
                className="max-h-[90vh] max-w-[90vw] rounded-lg bg-black object-contain"
                preload="metadata"
              />
            ) : (
              <PinchZoom onUpdate={handlePinchZoomUpdate}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage 署名付き URL の拡大表示 */}
                <img
                  ref={expandedImageRef}
                  src={expandedMedia.url}
                  alt=""
                  draggable={false}
                  className="max-h-[90vh] max-w-[90vw] rounded-lg bg-black object-contain"
                />
              </PinchZoom>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
