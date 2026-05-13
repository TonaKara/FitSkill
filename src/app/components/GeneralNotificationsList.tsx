"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2 } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  type NotificationRow,
  fetchGeneralNotifications,
  markNotificationAsRead,
} from "@/lib/transaction-notifications"
import {
  getGeneralNotificationListSubject,
  getAdminOpsAccordionContent,
  getAdminOpsAccordionTitle,
  getNotificationBodySectionLabel,
  parseTransactionIdFromNotificationReason,
} from "@/lib/notification-display"
import { cn } from "@/lib/utils"

type GeneralNotificationsListProps = {
  userId: string
  adminOrigin: boolean
  /** 既読にしたら親の未読カウントを減らす用 */
  onRead?: () => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  return d.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function GeneralNotificationsList({ userId, adminOrigin, onRead }: GeneralNotificationsListProps) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const markInFlight = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fErr } = await fetchGeneralNotifications(supabase, userId, adminOrigin, 50)
    if (fErr) {
      setError(fErr.message)
      setRows([])
    } else {
      setRows(data)
    }
    setLoading(false)
  }, [adminOrigin, supabase, userId])

  useEffect(() => {
    void load()
  }, [load])

  const markAsRead = useCallback(
    async (n: NotificationRow) => {
      if (markInFlight.current || n.is_read) {
        return
      }
      if (n.recipient_id == null) {
        return
      }
      markInFlight.current = true
      setUpdating(n.id)
      try {
        const { error: uErr } = await markNotificationAsRead(supabase, n.id)
        if (uErr) {
          console.error("既読更新エラー:", uErr)
          return
        }
        setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)))
        onRead?.()
      } finally {
        setUpdating(null)
        markInFlight.current = false
      }
    },
    [onRead, supabase],
  )

  const getNotificationHref = useCallback((n: NotificationRow): string | null => {
    if (n.type === "inquiry_message") {
      const peerId = n.sender_id?.trim() ?? ""
      if (peerId) {
        const reason = n.reason?.trim() ?? ""
        const skillMatch = /\|skill:([0-9]+)\s*$/.exec(reason)
        const q = skillMatch?.[1] ? `?skill_id=${encodeURIComponent(skillMatch[1])}` : ""
        return `/inquiry/${encodeURIComponent(peerId)}${q}`
      }
      return "/inquiry/list"
    }
    if (n.type === "consultation_request") {
      return "/mypage?tab=requests&mode=instructor"
    }
    if (n.type === "consultation_rejected") {
      return "/mypage?tab=requests&mode=student"
    }
    if (n.type === "consultation_accepted") {
      const reason = n.reason?.trim() ?? ""
      const m = reason.match(/^skill_id:(\d+)$/)
      if (m?.[1]) {
        return `/skills/${m[1]}`
      }
      return "/mypage?tab=requests&mode=student"
    }
    if (n.type === "completion_request" || n.type === "message" || n.type === "completion_approved" || n.type === "dispute") {
      const txId = parseTransactionIdFromNotificationReason(n.reason)
      if (txId) {
        return `/chat/${txId}`
      }
    }
    if (n.type === "purchase") {
      const txId = parseTransactionIdFromNotificationReason(n.reason)
      if (txId) {
        return `/chat/${txId}`
      }
    }
    return null
  }, [])

  const resolvePurchaseNotificationHref = useCallback(
    async (n: NotificationRow): Promise<string | null> => {
      const txId = parseTransactionIdFromNotificationReason(n.reason)
      if (txId) {
        return `/chat/${txId}`
      }

      const senderId = n.sender_id?.trim() ?? ""
      if (!senderId) {
        return null
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("id")
        .eq("buyer_id", senderId)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(5)
      if (error) {
        return null
      }
      const row = (data?.[0] ?? null) as { id?: string | number } | null
      if (row?.id == null) {
        return null
      }
      return `/chat/${String(row.id)}`
    },
    [supabase, userId],
  )

  const handleNotificationClick = useCallback(
    async (n: NotificationRow) => {
      if (markInFlight.current) {
        return
      }
      const notificationId = n.id
      markInFlight.current = true
      setUpdating(notificationId)
      try {
        const { error: uErr } = await markNotificationAsRead(supabase, notificationId)
        if (uErr) {
          console.error("既読更新エラー:", uErr)
          return
        }
        setRows((prev) => prev.map((r) => (r.id === notificationId ? { ...r, is_read: true } : r)))
        onRead?.()
        const href =
          n.type === "purchase"
            ? await resolvePurchaseNotificationHref(n)
            : getNotificationHref(n)
        if (href) {
          router.push(href)
        }
      } finally {
        setUpdating(null)
        markInFlight.current = false
      }
    },
    [getNotificationHref, onRead, resolvePurchaseNotificationHref, router, supabase],
  )

  const handleRowToggle = useCallback(
    async (n: NotificationRow) => {
      const isOpen = openIds.has(n.id)
      setOpenIds((prev) => {
        const next = new Set(prev)
        if (next.has(n.id)) {
          next.delete(n.id)
        } else {
          next.add(n.id)
        }
        return next
      })
      if (!isOpen && !n.is_read) {
        await markAsRead(n)
      }
    },
    [markAsRead, openIds],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="ml-2 text-sm">読み込み中…</span>
      </div>
    )
  }
  if (error) {
    return <p className="px-3 py-2 text-sm text-destructive">{error}</p>
  }
  if (rows.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-sm text-zinc-500">
        {adminOrigin ? "運営からの通知はまだありません" : "通知はまだありません"}
      </p>
    )
  }

  if (!adminOrigin) {
    return (
      <ul className="max-h-72 space-y-1 overflow-y-auto px-1">
        {rows.map((n) => {
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void handleNotificationClick(n)}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  n.is_read
                    ? "text-zinc-500 hover:bg-secondary/80"
                    : "bg-primary/5 font-medium text-foreground ring-1 ring-primary/20 hover:bg-primary/10",
                )}
              >
                <span className="line-clamp-2">
                  {n?.title?.trim()
                    ? `${getGeneralNotificationListSubject(n)}：${n.title.trim()}`
                    : getGeneralNotificationListSubject(n)}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">{n?.content?.trim() || "（内容なし）"}</span>
                <time className="mt-1 block text-xs text-zinc-500" dateTime={n?.created_at ?? ""}>
                  {formatTime(n?.created_at ?? "")}
                </time>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="max-h-80 space-y-1.5 overflow-y-auto px-1 pb-1">
      {rows.map((n) => {
        const isOpen = openIds.has(n.id)
        const accordionTitle = getAdminOpsAccordionTitle(n)
        const accordionContent = getAdminOpsAccordionContent(n)
        return (
          <li key={n.id} className="overflow-hidden rounded-md border border-border/70 bg-background/50">
            <button
              type="button"
              onClick={() => void handleRowToggle(n)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-start gap-2 px-2.5 py-2.5 text-left text-sm transition-colors",
                n.is_read
                  ? "text-zinc-500 hover:bg-secondary/60"
                  : "bg-primary/5 font-medium text-foreground ring-1 ring-primary/20 hover:bg-primary/10",
              )}
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap line-clamp-4 leading-snug">
                {accordionTitle}
              </span>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <ChevronDown
                  className={cn("h-4 w-4 text-zinc-500 transition-transform", isOpen && "rotate-180")}
                  aria-hidden
                />
                {updating === n.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" aria-label="更新中" />
                ) : (
                  <time className="whitespace-nowrap text-[10px] text-zinc-500" dateTime={n.created_at}>
                    {formatTime(n.created_at)}
                  </time>
                )}
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-border/60 bg-secondary/30 px-2.5 py-2.5 text-sm text-foreground/90">
                <p className="whitespace-pre-wrap break-words leading-relaxed">{accordionContent}</p>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
