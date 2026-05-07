"use client"

import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { buildProfilePath } from "@/lib/profile-path"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { autoCompleteMyPendingTransactionsWithPayout, completeTransactionWithPayout } from "@/actions/payout"
import { createTransactionNotification, NOTIFICATION_TYPE } from "@/lib/transaction-notifications"
import { DisputeEvidenceImage } from "@/components/DisputeEvidenceImage"
import { TransactionReviewCard } from "@/components/chat/TransactionReviewCard"
import { fetchMyTransactionReview, type TransactionReviewRow } from "@/lib/transaction-reviews"
import { cn, getUnknownErrorMessage } from "@/lib/utils"
import type { AppNotice } from "@/lib/notifications"

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

const CHAT_MEDIA_BUCKET = "chat-media"
/** Supabase Storage のバケット ID（必ず `dispute-evidence` と一致させる） */
const DISPUTE_EVIDENCE_BUCKET = "dispute-evidence" as const
const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024
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

type ChatMediaSignedProps = {
  supabase: SupabaseClient
  /** ストレージオブジェクトキー（例: `18/filename.png`） */
  path: string
  fileType: string | null
  onExpand?: (media: ExpandedMedia) => void
}

function ChatMediaSigned({ supabase, path, fileType, onExpand }: ChatMediaSignedProps) {
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
    return <p className="text-xs text-amber-200/90">メディアを読み込めませんでした。</p>
  }
  if (!signedUrl) {
    return (
      <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900">
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

function extensionFromMime(mime: string, fallback: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  }
  return map[mime] ?? fallback
}

function isMessageVideoType(t: string | null | undefined): boolean {
  return t === "video" || (typeof t === "string" && t.startsWith("video/"))
}

function fileKindFromFile(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "video"
  }
  return null
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
  const t = m.content?.trim() ?? ""
  if (!t) {
    return false
  }
  if (
    m.file_url &&
    (t === "[画像]" || t === "[動画]" || t === "[ファイル]")
  ) {
    return false
  }
  return true
}

export default function ChatTransactionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const transactionId =
    typeof params.transaction_id === "string"
      ? params.transaction_id
      : Array.isArray(params.transaction_id)
        ? params.transaction_id[0]
        : ""

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

  const listRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const expandedImageRef = useRef<HTMLImageElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const initialAutoScrollDoneRef = useRef(false)

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
        throw new Error("画像の取得に失敗しました。")
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
      window.alert("画像の保存に失敗しました。")
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
        router.replace(`/login?redirect=${encodeURIComponent(`/chat/${transactionId}`)}`)
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
  }, [router, supabase, transactionId])

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
      setLoadError("取引が見つかりません。")
      setTxLoading(false)
      return
    }

    const t = row as TransactionRow
    if (t.buyer_id !== userId && t.seller_id !== userId) {
      setTransaction(null)
      setOtherProfile(null)
      setLoadError("この取引にアクセスできません。")
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
      setLoadError("相手のプロフィールを読み込めませんでした。")
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
    console.log("【既読更新成功】:", data)
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

    const channel = supabase
      .channel(`messages:${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MessageRow
            if (!row?.id) {
              return
            }
            setMessages((prev) => mergeMessageRow(prev, row))
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
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, transactionId, transaction, userId])

  useEffect(() => {
    if (!messagesEndRef.current) {
      return
    }
    if (!initialAutoScrollDoneRef.current || shouldAutoScrollRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
      initialAutoScrollDoneRef.current = true
    }
  }, [messages, myTransactionReview, myTransactionReviewLoading, transaction?.status])

  const otherName = otherProfile?.display_name?.trim() || "相手"
  const otherAvatar = resolveProfileAvatarUrl(otherProfile?.avatar_url ?? null, otherName)
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
      if (transaction && userId) {
        const recipientId =
          userId === String(transaction.buyer_id) ? transaction.seller_id : transaction.buyer_id
        void createTransactionNotification(supabase, {
          recipient_id: String(recipientId),
          type: NOTIFICATION_TYPE.message,
          content: "新しいメッセージが届いています。",
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
    [supabase, transactionId, userId, transaction],
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked || !canSend || sending || linkSending || isClosed) {
      return
    }
    if (picked.size > MAX_CHAT_FILE_BYTES) {
      window.alert("ファイルサイズは10MB以下にしてください。")
      return
    }
    if (!fileKindFromFile(picked)) {
      window.alert("画像または動画のみ送信できます。")
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

    if (file) {
      if (file.size > MAX_CHAT_FILE_BYTES) {
        window.alert("ファイルサイズは10MB以下にしてください。")
        setSending(false)
        return
      }
      const kind = fileKindFromFile(file)
      if (!kind) {
        window.alert("画像または動画のみ送信できます。")
        setSending(false)
        return
      }
      const ext = extensionFromMime(file.type, file.name.split(".").pop() ?? "bin")
      const path = `${transactionId}/${crypto.randomUUID()}.${ext}`
      const { data: upData, error: upErr } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      })
      if (upErr || !upData?.path) {
        setSendError("ファイルのアップロードに失敗しました。")
        setSending(false)
        return
      }
      fileUrl = upData.path
      mediaType = kind
    }

    const ok = await insertMessage({
      content: trimmed,
      file_url: fileUrl,
      file_type: mediaType,
    })

    setSending(false)

    if (ok.error) {
      setSendError(fileUrl ? "メッセージの送信に失敗しました。" : "送信に失敗しました。")
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
          setNotice({ variant: "success", message: "この取引はすでに完了済みです" })
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
        setNotice({ variant: "error", message: "取引情報の更新に失敗しました" })
        return
      }

      setRequestAgreementOpen(false)
      setNotice({ variant: "success", message: "申請が完了しました" })
      if (userId) {
        void createTransactionNotification(supabase, {
          recipient_id: String(transaction.buyer_id),
          type: NOTIFICATION_TYPE.completion_request,
          content: "取引の完了申請が届いています。承認をお願いします。",
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
      setNotice({ variant: "error", message: "取引情報の更新に失敗しました" })
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
      setCompleteError("ログイン情報を確認できません。")
      return
    }
    setCompleteError(null)
    setCompleting(true)
    console.log("[tx-complete] start", {
      transactionId,
      userId,
      currentStatus: transaction?.status ?? null,
      isBuyer,
      isSeller,
    })
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
        setCompleteError("ログイン情報を確認できません。")
        return
      }

      await completeTransactionWithPayout(String(transactionId), "standard")
      console.log("2. ステータス更新完了（server action）")

      // --- 削除処理（messages.file_url → chat-media） ---
      console.log("--- 削除処理開始 ---")

      const { data: messages, error: dbError } = await supabase
        .from("messages")
        .select("file_url")
        .eq("transaction_id", transactionId)
        .not("file_url", "is", null)

      if (dbError) {
        console.error("DB取得エラー:", dbError)
        setCompleteError("チャットのファイル情報の取得に失敗しました。ストレージの削除はスキップされました。")
        return
      }

      if (messages && messages.length > 0) {
        const extractedFileNames = (messages as { file_url: string }[]).map((m) => {
          const url = m.file_url
          const urlParts = url.split("/")
          return urlParts[urlParts.length - 1] ?? url
        })
        const pathsToRemove = [...new Set(extractedFileNames)]

        console.log("削除対象のファイル名リスト:", pathsToRemove)

        if (pathsToRemove.length > 0) {
          const fullPaths = pathsToRemove.map((name) => `${transactionId}/${name}`)

          console.log("最終的に削除するフォルダパス:", fullPaths)

          const { error: removeError } = await supabase.storage
            .from(CHAT_MEDIA_BUCKET)
            .remove(fullPaths)

          if (removeError) {
            console.error("削除エラー:", removeError)
          } else {
            console.log("削除成功！フォルダを含めて処理しました。")
          }
        }
      } else {
        console.log("この取引IDには削除すべきファイルがありません。")
      }

      console.log("[tx-complete] success", {
        transactionId: String(transactionId),
        mediaCleanup: {
          messageFileRows: messages?.length ?? 0,
        },
      })
      if (transaction) {
        void createTransactionNotification(supabase, {
          recipient_id: String(transaction.seller_id),
          type: NOTIFICATION_TYPE.completion_approved,
          content: "取引が買主により承認され、完了しました。",
          reason: `transaction_id:${String(transactionId)}`,
        }).then(({ error: nErr }) => {
          if (nErr) {
            console.error("[tx-complete] createTransactionNotification (approved)", {
              message: nErr.message,
              code: nErr.code,
              details: nErr.details,
            })
          }
        })
      }
      setApproveAgreementOpen(false)
      await loadTransactionAndPeer()
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        setNotice({ variant: "error", message: "ログインセッションが切れました。再度ログインしてください。" })
        router.push("/login")
        return
      }
      const userMsg = getUnknownErrorMessage(error, "取引の承認に失敗しました。時間を置いて再度お試しください。")
      console.error("[tx-complete] error", {
        transactionId,
        message: userMsg,
        raw: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      })
      setCompleteError(userMsg)
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
      setCompleteError("異議申し立て理由を選択してください。")
      return
    }
    if (disputedEvidenceUploading) {
      setCompleteError("写真のアップロード完了後に送信してください。")
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
        setCompleteError("写真のアップロードに失敗しました。")
        if (isAdmin) {
          setNotice({
            variant: "error",
            message: "写真アップロードに失敗したため、取引情報は更新されませんでした。",
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
      setCompleteError("異議申し立ての送信に失敗しました。")
      return
    }
    setShowDisputeReasonPicker(false)
    setDisputeEvidenceFile(null)
    if (transaction) {
      void createTransactionNotification(supabase, {
        recipient_id: String(transaction.seller_id),
        type: NOTIFICATION_TYPE.dispute,
        content: "取引に異議申し立てがありました。内容を確認してください。",
        reason: `transaction_id:${String(transactionId)}`,
      }).then(({ error: nErr }) => {
        if (nErr) {
          console.error("[dispute] createTransactionNotification", {
            message: nErr.message,
            code: nErr.code,
            details: nErr.details,
          })
        }
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
      setCompleteError("証拠写真は画像ファイルのみアップロードできます。")
      return
    }
    if (picked.size > MAX_DISPUTE_EVIDENCE_BYTES) {
      setCompleteError("証拠写真は10MB以下にしてください。")
      return
    }

    setCompleteError(null)
    setDisputeEvidenceFile(picked)
  }

  const handleDisputeEvidenceClear = () => {
    setDisputeEvidenceFile(null)
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
      setSendError("連携情報の送信に失敗しました。")
      return
    }
    setLinkModalOpen(false)
  }

  if (authLoading || !transactionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    const redirectTo = transactionId
      ? `/login?redirect=${encodeURIComponent(`/chat/${String(transactionId)}`)}`
      : "/login"
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-zinc-100">
        <p className="text-center text-sm text-zinc-300">この取引チャットを開くにはログインが必要です。</p>
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-500"
          onClick={() => router.replace(redirectTo)}
        >
          ログインへ
        </Button>
      </div>
    )
  }

  if (txLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <span className="ml-2 text-sm">取引を読み込み中...</span>
      </div>
    )
  }

  if (loadError || !transaction) {
    return (
      <div className="min-h-screen bg-black px-4 py-10 text-zinc-100">
        <div className="mx-auto max-w-2xl">
          <Button
            type="button"
            variant="outline"
            className="mb-8 border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
            onClick={() => router.back()}
          >
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              戻る
            </span>
          </Button>
          <p className="text-center text-red-400">{loadError ?? "取引を開けませんでした。"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-zinc-100">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              onClick={() => router.back()}
            >
              <span aria-label="戻る">
                <ArrowLeft className="h-5 w-5" />
              </span>
            </Button>
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
              <Image
                src={otherAvatar}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{otherName}</p>
              <p className="text-xs text-zinc-500">取引チャット</p>
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
                  className="border-amber-600/60 bg-amber-950/40 text-amber-100 hover:border-amber-500 hover:bg-amber-950/70"
                >
                  {completing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : isApprovalPending ? (
                    "相手の承認をお待ちください"
                  ) : isCanceledOrRefunded ? (
                    "取引はキャンセルまたは返金により終了しました"
                  ) : isCompleted ? (
                    "この取引は終了しています"
                  ) : (
                    "完了申請を送る"
                  )}
                </Button>
              ) : null}
              {completeError ? <span className="text-xs text-red-400">{completeError}</span> : null}
            </div>
          ) : null}

          {isBuyer && isApprovalPending ? (
            <div className="flex flex-col gap-2 pl-[52px]">
              <p className="text-xs text-amber-200/90">
                完了申請が届いています。問題がなければ承認、問題があれば異議申し立てを行ってください。
              </p>
              {transaction.applied_at ? (
                <p className="text-[11px] text-zinc-400">
                  {formatAppliedDeadline(transaction.applied_at)} までに操作がない場合は自動的に完了します。
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
                  取引完了
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={completing}
                  onClick={() => setShowDisputeReasonPicker((prev) => !prev)}
                  className="border-red-500/50 bg-red-950/30 text-red-100 hover:bg-red-950/60"
                >
                  異議申し立て
                </Button>
              </div>
              {showDisputeReasonPicker ? (
                <div className="mt-1 flex w-full min-w-0 flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900/70 p-2">
                  <select
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="h-9 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm text-zinc-100"
                  >
                    {DISPUTE_REASON_OPTIONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={disputed_reason_detail}
                    onChange={(e) => setDisputedReasonDetail(e.target.value)}
                    rows={4}
                    placeholder="詳細をご記入ください"
                    className="w-full rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                    maxLength={2000}
                  />
                  <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDisputeEvidenceSelect}
                      disabled={completing || disputedEvidenceUploading}
                      className="block max-w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border file:border-zinc-600 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:text-zinc-100 hover:file:bg-zinc-800"
                    />
                    {disputedEvidenceUploading ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-200">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        アップロード中...
                      </span>
                    ) : null}
                  </div>
                  {disputeEvidencePreviewUrl ? (
                    <div className="w-full min-w-0">
                      <div className="flex w-32 max-w-full flex-col gap-2">
                        <div className="relative w-32 max-w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-100 p-1 aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element -- ローカルプレビュー用 blob URL */}
                          <img
                            src={disputeEvidencePreviewUrl}
                            alt="証拠写真プレビュー"
                            className="h-full w-full rounded object-contain"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleDisputeEvidenceClear}
                          disabled={completing || disputedEvidenceUploading}
                          className="h-7 border border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={completing || disputedEvidenceUploading}
                    onClick={() => void handleDisputeSubmit()}
                    className="w-fit bg-red-600 text-white hover:bg-red-500"
                  >
                    {completing || disputedEvidenceUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        送信中...
                      </>
                    ) : (
                      "理由を送信"
                    )}
                  </Button>
                </div>
              ) : null}
              {completeError ? <span className="text-xs text-red-400">{completeError}</span> : null}
            </div>
          ) : null}

          {isBannedUser ? (
            <p className="pl-[52px] text-xs text-amber-200">
              このアカウントは現在利用停止中のため、進行中取引のメッセージ閲覧のみ可能です。新規送信はできません。
            </p>
          ) : isCanceledOrRefunded ? (
            <p className="pl-[52px] text-xs text-zinc-500">
              取引はキャンセルまたは返金により終了しています。メッセージの送信はできません。
            </p>
          ) : isCompleted ? (
            <p className="pl-[52px] text-xs text-zinc-500">この取引は終了しています。メッセージの送信はできません。</p>
          ) : isDisputed ? (
            <div className="pl-[52px]">
              <div className="max-w-full rounded-md border border-amber-500/30 bg-amber-950/35 px-3 py-2 text-xs leading-snug text-amber-50/95">
                {isBuyer
                  ? "この取引は異議申し立て中です。運営の確認が入るまで完了しません。"
                  : isSeller
                    ? "異議申し立てが行われました。運営の確認をお待ちください。"
                    : "この取引は異議申し立て中です。運営の確認が入るまで完了しません。"}
              </div>
              {canViewDisputeSubmission ? (
                <div className="mt-2 max-w-full space-y-2 rounded-md border border-zinc-700/70 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200">
                  {transaction.disputed_reason ? (
                    <p>
                      <span className="text-zinc-500">理由:</span> {transaction.disputed_reason}
                    </p>
                  ) : null}
                  {transaction.disputed_reason_detail ? (
                    <p className="whitespace-pre-wrap">
                      <span className="text-zinc-500">詳細:</span> {transaction.disputed_reason_detail}
                    </p>
                  ) : null}
                  {transaction.disputed_evidence_url?.trim() ? (
                    <DisputeEvidenceImage
                      pathOrUrl={transaction.disputed_evidence_url}
                      alt="異議申し立ての証拠写真"
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

      <div
        ref={listRef}
        onScroll={handleMessageListScroll}
        className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messagesLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          </div>
        ) : (
          <>
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">まだメッセージがありません。挨拶を送ってみましょう。</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId
            const prof = senderProfiles[m.sender_id]
            const label = mine ? "自分" : prof?.display_name?.trim() || "ユーザー"
            const avatarSrc = resolveProfileAvatarUrl(prof?.avatar_url ?? null, label)
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

            const bubble = (
              <div
                className={cn(
                  "rounded-2xl text-sm leading-relaxed",
                  isYoutubeMessage ? "w-full" : "",
                  isYoutubeMessage ? "p-2" : "px-3 py-2",
                  mine
                    ? "bg-red-600 text-white"
                    : "border border-zinc-700 bg-zinc-900 text-zinc-100",
                )}
              >
                {linkPayload ? (
                  <ChatLinkMessageCard payload={linkPayload} mine={mine} />
                ) : m.file_type === CHAT_LINK_FILE_TYPE ? (
                  <p className={cn("text-xs", mine ? "text-red-100/95" : "text-amber-200/90")}>
                    リンク情報を読み取れませんでした。
                  </p>
                ) : m.file_type === CHAT_YOUTUBE_FILE_TYPE ? (
                  youtubeFromFileType ? (
                    <ChatYoutubeRich url={youtubeFromFileType} mine={mine} />
                  ) : (
                    <p className={cn("text-xs", mine ? "text-red-100/95" : "text-amber-200/90")}>
                      YouTube の URL を読み取れませんでした。
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
                        onExpand={(media) => setExpandedMedia(media)}
                      />
                    ) : null}
                    {m.content?.trim() ? (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    ) : !m.file_url && shouldShowMessageText(m) ? (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    ) : null}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-1 flex items-center gap-2 tabular-nums",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  <p className={cn("text-[11px]", mine ? "text-red-100/90" : "text-zinc-500")}>
                    {formatMessageTime(m.created_at)}
                  </p>
                  {mine ? (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        m.is_read ? "text-red-100/85" : "text-amber-200",
                      )}
                    >
                      {m.is_read ? "既読" : "未読"}
                    </span>
                  ) : null}
                </div>
              </div>
            )

            if (mine) {
              return (
                <div key={messageIdKey(m.id)} className="flex w-full justify-end">
                  <div className={cn("flex min-w-0 flex-col items-end gap-1", bubbleWidthClass)}>
                    <p className="max-w-full truncate px-1 text-left text-xs text-zinc-500">{label}</p>
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
                  aria-label={`${label}のプロフィールへ`}
                >
                  <div className="relative h-9 w-9 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                    <Image src={avatarSrc} alt="" fill className="object-cover" sizes="36px" unoptimized />
                  </div>
                </Link>
                <div
                  className={cn(
                    "min-w-0",
                    isYoutubeMessage ? "flex-1 max-w-[400px]" : "max-w-[calc(100%-2.75rem)]",
                  )}
                >
                  <p className="mb-1 truncate text-xs text-zinc-400">{label}</p>
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
              peerNoun={isBuyer ? "出品者" : "購入者"}
              initialReview={myTransactionReview}
              reviewLoading={myTransactionReviewLoading}
              onReviewSaved={(row) => {
                setMyTransactionReview(row)
                setNotice({ variant: "success", message: "評価を送信しました。" })
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

      <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <form
          onSubmit={(e) => void handleSend(e)}
          className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3"
        >
          {file ? (
            <div className="relative overflow-hidden rounded-lg border border-zinc-600 bg-zinc-900/80 p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={sending}
                className="absolute right-1 top-1 z-10 h-8 w-8 rounded-full bg-black/60 text-zinc-200 hover:bg-black/80 hover:text-white"
                aria-label="添付を取り消し"
                onClick={clearPendingFile}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex min-h-[5rem] max-h-40 items-center justify-center overflow-hidden rounded-md bg-black/40">
                {previewUrl ? (
                  file.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ローカルプレビュー用 blob URL
                    <img src={previewUrl} alt="" className="max-h-40 w-full object-contain" />
                  ) : (
                    <video src={previewUrl} controls className="max-h-40 w-full object-contain" preload="metadata" />
                  )
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" aria-hidden />
                )}
              </div>
              <p className="mt-1 truncate text-center text-[11px] text-zinc-500">{file.name}</p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={!canSend || sending || linkSending}
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canSend || sending || linkSending}
              className="shrink-0 border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
              aria-label="画像または動画を添付"
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
                className="shrink-0 border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
                aria-label={isSeller ? "外部ツール連携（Zoom / YouTube）" : "外部ツール連携（YouTube）"}
                onClick={() => setLinkModalOpen(true)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={canSend ? "メッセージを入力..." : "送信できません"}
              disabled={!canSend || sending || linkSending}
              className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
              maxLength={8000}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={!canSend || sending || linkSending || (!text.trim() && !file)}
              className="shrink-0 bg-red-600 text-white hover:bg-red-500"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {isBannedUser ? (
              "利用停止中は進行中取引のチャット閲覧のみ可能です。"
            ) : (
              <>
                ＋でファイルを選び、本文を書いてから送信でまとめて送れます（1ファイル
                <strong className="font-medium text-zinc-400">10MB以下</strong>・画像または動画のみ）。
              </>
            )}
          </p>
        </form>
        {sendError ? <p className="mx-auto max-w-2xl px-4 pb-2 text-center text-xs text-red-400">{sendError}</p> : null}
      </footer>

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
            className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="request-agreement-title" className="text-lg font-bold text-white">
              【取引完了申請に関する重要事項】
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>
                生徒が取引完了ボタンを押すと、写真・動画データはサーバーから完全に削除され、復元できなくなります。
              </p>
              <p>
                生徒からの承認がない場合でも、申請から3日経過すると自動的に取引完了となり、報酬が確定します。
              </p>
              <p>
                生徒から「異議申し立て」が行われた場合、運営による調査が入ります。その間、報酬の確定・振込は一時停止されます。調査には数日〜1週間程度かかる場合があります。
              </p>
              <p>上記の内容を理解し、取引完了申請を行いますか？</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={completing}
                className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => setRequestAgreementOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                disabled={completing}
                className="bg-amber-600 text-white hover:bg-amber-500"
                onClick={() => void handleApplyCompletion()}
              >
                {completing ? "処理中..." : "同意して申請する"}
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
            className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="approve-agreement-title" className="text-lg font-bold text-white">
              【取引完了の最終確認】
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>
                この操作を行うと、チャット内の写真・動画データはサーバーから完全に削除され、復元できなくなります。
              </p>
              <p>取引完了を承認すると、講師への支払いが確定し、キャンセルはできなくなります。</p>
              <p>
                もし指導内容に不備がある場合は、「異議申し立て」を行ってください。その際、証拠となる画像やチャットログが必要となります。
              </p>
              <p>運営の確認作業には時間がかかる場合がありますのでご了承ください。</p>
              <p>取引を完了し、データを削除しますか？</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={completing}
                className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => setApproveAgreementOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                disabled={completing}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => void handleApproveCompletion()}
              >
                {completing ? "処理中..." : "取引を完了する"}
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
                保存
              </button>
            ) : null}
            <button
              type="button"
              aria-label="閉じる"
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
