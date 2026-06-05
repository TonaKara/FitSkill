"use client"

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react"
import { safeClientLogError } from "@/lib/safe-client-log"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  deleteGritvibAdminMessageAction,
  fetchGritvibAdminThreadMessagesAction,
  listGritvibAdminThreadsAction,
  markGritvibAdminThreadReadAction,
  sendGritvibAdminMessageAction,
  type GritvibAdminMessage,
  type GritvibAdminThreadSummary,
} from "@/talk/admin/_actions"
import { TalkComposerTextarea } from "@/talk/_composer-textarea"
import { TalkMessageBubble } from "@/talk/_message-bubble"
import { useChatScrollToBottomOnOpen } from "@/lib/use-chat-scroll-to-bottom-on-open"
import {
  useGritvibChatImageUrls,
  usePreloadGritvibChatImages,
} from "@/lib/talk/chat-image-urls"
import {
  createOptimisticGritvibMessage,
  mapGritvibChatMessageRow,
  mergeGritvibChatMessage,
  mergeGritvibChatMessageAfterRealtime,
  reconcileGritvibChatMessagesFromServer,
  removeOptimisticGritvibMessage,
  replaceOptimisticGritvibMessage,
  type GritvibChatMessageRow,
  type GritvibChatMessageView,
} from "@/lib/talk/gritvib-chat-message"
import {
  readAdminThreadCache,
  writeAdminThreadCache,
} from "@/lib/talk/gritvib-chat-session-cache"
import {
  listGritvibAdminMemberChargesAction,
  refundGritvibAdminChargeAction,
  type GritvibAdminCharge,
} from "@/talk/admin/_refund-actions"
import { AdminInquiriesPanel } from "@/talk/admin/_inquiries"
import { AdminSubscriptionCapacitySettings } from "@/talk/admin/_capacity-settings"
import {
  describeGritvibChatSubscriptionStatus,
  isGritvibChatSubscriptionActive,
} from "@/lib/talk/gritvib-subscription-capacity"
import { listGritvibInquiriesAction } from "@/talk/admin/_inquiry-actions"
import { MobileAdminSheet } from "@/talk/admin/_mobile-admin-sheet"
import {
  useClientMounted,
  useGritvibAdminMobileLayout,
} from "@/lib/talk/use-admin-mobile-layout"

/**
 * GritVib 管理画面 (オペレーター用) のクライアント本体。
 *
 * 表示:
 *   - PC (md 以上): 左 = スレッド一覧、右 = 選択スレッドのチャット (split view)
 *   - モバイル: 既定はスレッド一覧。スレッドを開くと一覧を隠してチャットを全画面表示。
 *
 * 選択中スレッドの保持:
 *   - URL クエリ `?thread=<member_id>` で表現する (再読み込み・共有可能)。
 *   - 一覧 / チャット側のどちらでも `router.replace` で更新する。
 *
 * 返金:
 *   - 一覧の各行に「返金」ボタン。押すと Modal を開き、Stripe の Charge 一覧を表示。
 *   - Modal の中で対象 Charge ごとに「返金する」ボタン (= PaymentIntent 全額返金)。
 */

const STORAGE_BUCKET = "gritvib-chat-photos"
const MESSAGE_BODY_MAX_LENGTH = 2000
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

type MessageRow = {
  id: string
  thread_member_id: string
  sender_role: "member" | "operator"
  sender_user_id: string
  body: string | null
  image_path: string | null
  created_at: string
}

function rowToMessage(row: MessageRow): GritvibAdminMessage {
  return mapGritvibChatMessageRow(row)
}

function formatJa(dt: string | null): string {
  if (!dt) return ""
  try {
    const d = new Date(dt)
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return dt
  }
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / (currency.toLowerCase() === "jpy" ? 1 : 100))
  } catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}

function isThreadSubscriptionActive(thread: GritvibAdminThreadSummary): boolean {
  return isGritvibChatSubscriptionActive(
    thread.subscriptionStatus,
    thread.subscriptionCurrentPeriodEnd,
  )
}

function guessImageExtension(mimeType: string, filename: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    default: {
      const idx = filename.lastIndexOf(".")
      if (idx >= 0) {
        const ext = filename.slice(idx + 1).toLowerCase()
        if (ext.length >= 2 && ext.length <= 5) return ext
      }
      return "bin"
    }
  }
}

type AdminView = "chat" | "inquiries"

export function AdminChatPage({
  adminUserId,
  adminNickname,
  initialThreads,
  initialInquiryPendingCount = 0,
}: {
  adminUserId: string
  adminNickname: string
  initialThreads: GritvibAdminThreadSummary[]
  initialInquiryPendingCount?: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const adminView: AdminView =
    searchParams.get("view") === "inquiries" ? "inquiries" : "chat"
  const selectedMemberId = searchParams.get("thread") ?? null
  const [inquiryPendingCount, setInquiryPendingCount] = useState(
    initialInquiryPendingCount,
  )

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [threads, setThreads] = useState<GritvibAdminThreadSummary[]>(initialThreads)
  const [refreshing, setRefreshing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const isMobileLayout = useGritvibAdminMobileLayout()
  const clientMounted = useClientMounted()

  const selectedThread = useMemo(
    () => threads.find((t) => t.memberId === selectedMemberId) ?? null,
    [threads, selectedMemberId],
  )

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } catch {
      safeClientLogError("[talk/admin] signOut failed")
    } finally {
      router.replace("/")
      router.refresh()
    }
  }, [router, signingOut, supabase])

  /** 一覧を再取得して state に反映。 */
  const refreshThreads = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await listGritvibAdminThreadsAction()
      if (result.ok) {
        setThreads(result.threads)
      } else {
        safeClientLogError("[talk/admin] refresh threads failed")
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  /** スレッドを開いたら DB に既読を保存（ページを離れて戻っても未読に戻らない）。 */
  useLayoutEffect(() => {
    if (!selectedMemberId) return

    setThreads((prev) =>
      prev.map((t) =>
        t.memberId === selectedMemberId ? { ...t, unreadCount: 0, oldestUnreadAt: null } : t,
      ),
    )

    void (async () => {
      const result = await markGritvibAdminThreadReadAction(selectedMemberId)
      if (!result.ok) {
        safeClientLogError("[talk/admin] mark thread read failed")
        return
      }
      await refreshThreads()
    })()
  }, [selectedMemberId, refreshThreads])

  /**
   * Realtime: 任意の thread のメッセージ INSERT / DELETE を監視し、
   * 一覧の未読バッジ / ソート順を最新に保つ。
   * 大量に来た場合の連打を避けるため debounce する。
   */
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      void refreshThreads()
    }, 800)
  }, [refreshThreads])

  useEffect(() => {
    const channel = supabase
      .channel("gritvib_chat_messages_admin_list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gritvib_chat_messages" },
        () => scheduleRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "gritvib_chat_messages" },
        () => scheduleRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gritvib_chat_members" },
        () => scheduleRefresh(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          safeClientLogError("[talk/admin] thread list realtime subscription failed")
        }
      })
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void supabase.removeChannel(channel)
    }
  }, [supabase, scheduleRefresh])

  const handleSelectThread = useCallback(
    (memberId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", "chat")
      params.delete("inquiry")
      if (memberId) {
        params.set("thread", memberId)
      } else {
        params.delete("thread")
      }
      const qs = params.toString()
      router.replace(`/talk/admin?${qs}`)
    },
    [router, searchParams],
  )

  const handleSwitchView = useCallback(
    (view: AdminView) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", view)
      if (view === "chat") {
        params.delete("inquiry")
      } else {
        params.delete("thread")
      }
      router.replace(`/talk/admin?${params.toString()}`)
    },
    [router, searchParams],
  )

  /** 問い合わせの未対応件数（バッジ用）。 */
  useEffect(() => {
    void (async () => {
      const result = await listGritvibInquiriesAction({ status: "all" })
      if (result.ok) setInquiryPendingCount(result.pendingCount)
    })()
  }, [adminView])

  /** Refund Modal の対象 */
  const [refundTarget, setRefundTarget] = useState<GritvibAdminThreadSummary | null>(null)

  return (
    <div className="flex h-[100svh] flex-col bg-white text-black">
      <header className="shrink-0 border-b border-zinc-200 px-3 py-2.5 text-sm md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href="/"
              className="truncate text-sm font-semibold text-black transition-colors hover:text-zinc-600 md:hidden"
            >
              GritVib
            </Link>
            <span className="hidden truncate text-[11px] font-normal uppercase tracking-[0.2em] text-zinc-400 md:inline">
              GritVib · 管理画面
            </span>
            <AdminViewNav
              adminView={adminView}
              inquiryPendingCount={inquiryPendingCount}
              onSwitchView={handleSwitchView}
              className="hidden md:flex"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            {adminView === "chat" ? (
              <button
                type="button"
                onClick={() => void refreshThreads()}
                disabled={refreshing}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-zinc-300 px-2.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                <span>更新</span>
              </button>
            ) : null}
            <Link
              href="/talk/settings/password"
              className="inline-flex h-8 items-center justify-center rounded-full border border-zinc-300 px-2.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 md:px-3"
            >
              パスワード
            </Link>
            <Link
              href="/"
              className="hidden h-8 items-center justify-center rounded-full bg-black px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 md:inline-flex"
            >
              トップへ
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 px-2.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3"
            >
              {signingOut ? "ログアウト中…" : "ログアウト"}
            </button>
          </div>
        </div>
        <AdminViewNav
          adminView={adminView}
          inquiryPendingCount={inquiryPendingCount}
          onSwitchView={handleSwitchView}
          className="mt-2 flex w-full md:hidden"
        />
      </header>

      {adminView === "inquiries" ? (
        <AdminInquiriesPanel
          pendingCount={inquiryPendingCount}
          onPendingCountChange={setInquiryPendingCount}
        />
      ) : (
        <>
      <div className="relative flex min-h-0 flex-1">
        {/* スレッド一覧（スマホでも常に背面に表示） */}
        <aside className="flex min-h-0 w-full flex-col border-r border-zinc-200 md:w-80 md:flex-none">
          <AdminSubscriptionCapacitySettings />
          <ThreadList
            threads={threads}
            selectedMemberId={selectedMemberId}
            onSelect={handleSelectThread}
            onRefundClick={(t) => setRefundTarget(t)}
          />
        </aside>

        {/* 選択中スレッド（PC のみインライン。スマホは下のシートのみ＝Realtime チャンネル重複を防ぐ） */}
        <section className="hidden min-h-0 flex-1 flex-col md:flex">
          {selectedThread && clientMounted && !isMobileLayout ? (
            <AdminThreadConversation
              key={selectedThread.memberId}
              adminUserId={adminUserId}
              adminNickname={adminNickname}
              thread={selectedThread}
              supabase={supabase}
              onAfterSend={() => void refreshThreads()}
              onAfterDelete={() => void refreshThreads()}
            />
          ) : !selectedThread ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              左の一覧からスレッドを選択してください。
            </div>
          ) : null}
        </section>

        {/* スマホ: 会話をオーバーレイ表示 */}
        {clientMounted && isMobileLayout && selectedThread ? (
          <MobileAdminSheet
            title={selectedThread.nickname}
            subtitle={describeGritvibChatSubscriptionStatus(
              selectedThread.subscriptionStatus,
              selectedThread.subscriptionCurrentPeriodEnd,
            )}
            onClose={() => handleSelectThread(null)}
          >
            <AdminThreadConversation
              key={selectedThread.memberId}
              adminUserId={adminUserId}
              adminNickname={adminNickname}
              thread={selectedThread}
              supabase={supabase}
              hideThreadHeader
              onAfterSend={() => void refreshThreads()}
              onAfterDelete={() => void refreshThreads()}
            />
          </MobileAdminSheet>
        ) : null}
      </div>

      {refundTarget ? (
        <RefundModal
          thread={refundTarget}
          onClose={() => setRefundTarget(null)}
        />
      ) : null}
        </>
      )}
    </div>
  )
}

function AdminViewNav({
  adminView,
  inquiryPendingCount,
  onSwitchView,
  className,
}: {
  adminView: "chat" | "inquiries"
  inquiryPendingCount: number
  onSwitchView: (view: "chat" | "inquiries") => void
  className?: string
}) {
  return (
    <nav
      className={[
        "items-center gap-1 rounded-full border border-zinc-200 p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="管理メニュー"
    >
      <button
        type="button"
        onClick={() => onSwitchView("chat")}
        className={[
          "flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:flex-none md:py-1",
          adminView === "chat"
            ? "bg-black text-white"
            : "text-zinc-600 hover:bg-zinc-100",
        ].join(" ")}
      >
        チャット
      </button>
      <button
        type="button"
        onClick={() => onSwitchView("inquiries")}
        className={[
          "relative flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors md:flex-none md:py-1",
          adminView === "inquiries"
            ? "bg-black text-white"
            : "text-zinc-600 hover:bg-zinc-100",
        ].join(" ")}
      >
        問い合わせ
        {inquiryPendingCount > 0 ? (
          <span className="ml-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950">
            {inquiryPendingCount > 99 ? "99+" : inquiryPendingCount}
          </span>
        ) : null}
      </button>
    </nav>
  )
}

type ThreadQueueFilter = "pending" | "done" | "unsent"

const THREAD_QUEUE_FILTER_OPTIONS: { value: ThreadQueueFilter; label: string }[] = [
  { value: "pending", label: "未対応" },
  { value: "unsent", label: "未送信" },
  { value: "done", label: "対応済み" },
]

type ThreadSubscriptionFilter = "active" | "inactive"

const THREAD_SUBSCRIPTION_FILTER_OPTIONS: {
  value: ThreadSubscriptionFilter
  label: string
}[] = [
  { value: "active", label: "サブスク有効" },
  { value: "inactive", label: "サブスク無効" },
]

function threadHasNoMessages(thread: GritvibAdminThreadSummary): boolean {
  return thread.lastMessageAt === null
}

function ThreadList({
  threads,
  selectedMemberId,
  onSelect,
  onRefundClick,
}: {
  threads: GritvibAdminThreadSummary[]
  selectedMemberId: string | null
  onSelect: (id: string) => void
  onRefundClick: (t: GritvibAdminThreadSummary) => void
}) {
  const isMobileLayout = useGritvibAdminMobileLayout()
  const [queueFilter, setQueueFilter] = useState<ThreadQueueFilter>("pending")
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<ThreadSubscriptionFilter>("active")
  const [nicknameQuery, setNicknameQuery] = useState("")

  const pendingCount = useMemo(
    () => threads.filter((t) => t.unreadCount > 0).length,
    [threads],
  )
  const unsentCount = useMemo(
    () => threads.filter((t) => threadHasNoMessages(t)).length,
    [threads],
  )

  const visibleThreads = useMemo(() => {
    const q = isMobileLayout ? "" : nicknameQuery.trim().toLowerCase()
    const filtered = threads.filter((thread) => {
      const matchesQueue =
        queueFilter === "pending"
          ? thread.unreadCount > 0
          : queueFilter === "unsent"
            ? threadHasNoMessages(thread)
            : thread.unreadCount === 0 && !threadHasNoMessages(thread)
      if (!matchesQueue) return false
      if (queueFilter === "unsent") {
        const active = isThreadSubscriptionActive(thread)
        if (subscriptionFilter === "active" && !active) return false
        if (subscriptionFilter === "inactive" && active) return false
      }
      if (!q) return true
      return thread.nickname.toLowerCase().includes(q)
    })

    const sorted = [...filtered]
    if (queueFilter === "pending") {
      /** 未対応: いちばん待たせている（未読の最古）順 */
      sorted.sort((a, b) => {
        const ao = a.oldestUnreadAt ?? a.lastMessageAt ?? a.memberCreatedAt
        const bo = b.oldestUnreadAt ?? b.lastMessageAt ?? b.memberCreatedAt
        return ao.localeCompare(bo)
      })
    } else if (queueFilter === "unsent") {
      /** 未送信: 登録が新しい順 */
      sorted.sort((a, b) => b.memberCreatedAt.localeCompare(a.memberCreatedAt))
    } else {
      /** 対応済み: 直近のやり取りが新しい順 */
      sorted.sort((a, b) => {
        const aTs = a.lastMessageAt ?? ""
        const bTs = b.lastMessageAt ?? ""
        return bTs.localeCompare(aTs)
      })
    }
    return sorted
  }, [threads, queueFilter, subscriptionFilter, nicknameQuery, isMobileLayout])

  const listTitle =
    queueFilter === "pending" && pendingCount > 0
      ? `会員（未対応 ${pendingCount}）`
      : queueFilter === "unsent" && unsentCount > 0
        ? `会員（未送信 ${unsentCount}）`
        : "会員一覧"

  if (threads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center text-sm text-zinc-500">
        まだ会員がいません。
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-200 px-3 py-2.5 md:px-4 md:py-3">
        <h2 className="text-sm font-semibold text-black">{listTitle}</h2>

        <select
          id="thread-queue-filter"
          aria-label="未対応・未送信・対応済み"
          value={queueFilter}
          onChange={(e) => setQueueFilter(e.target.value as ThreadQueueFilter)}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none focus:ring-1 focus:ring-black md:mt-3"
        >
          {THREAD_QUEUE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {queueFilter === "unsent" ? (
          <select
            id="thread-subscription-filter"
            aria-label="サブスクリプション状態で絞り込み"
            value={subscriptionFilter}
            onChange={(e) =>
              setSubscriptionFilter(e.target.value as ThreadSubscriptionFilter)
            }
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            {THREAD_SUBSCRIPTION_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}

        <div className="mt-3 hidden md:block">
          <label
            className="block text-[11px] text-zinc-500"
            htmlFor="thread-nickname-search"
          >
            ユーザー名で検索
          </label>
          <input
            id="thread-nickname-search"
            type="search"
            value={nicknameQuery}
            onChange={(e) => setNicknameQuery(e.target.value)}
            placeholder="ニックネーム"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {visibleThreads.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-zinc-500">
          {!isMobileLayout && nicknameQuery.trim()
            ? "該当するユーザーが見つかりません。"
            : queueFilter === "pending"
              ? "未対応のスレッドはありません。"
              : queueFilter === "unsent"
                ? "未送信の会員はいません。"
                : "対応済みのスレッドはありません。"}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {visibleThreads.map((thread) => {
            const isSelected = thread.memberId === selectedMemberId
            const hasUnread = thread.unreadCount > 0
            const listTimestamp = thread.lastMessageAt ?? thread.memberCreatedAt
            return (
              <li key={thread.memberId}>
                <button
                  type="button"
                  onClick={() => onSelect(thread.memberId)}
                  className={[
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-zinc-400 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={[
                          "truncate text-sm text-black",
                          hasUnread ? "font-semibold" : "font-medium",
                        ].join(" ")}
                      >
                        {thread.nickname}
                      </p>
                      <span className="shrink-0 text-[10px] text-zinc-400">
                        {formatJa(listTimestamp)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px]",
                          isThreadSubscriptionActive(thread)
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 text-zinc-500",
                        ].join(" ")}
                      >
                        {describeGritvibChatSubscriptionStatus(
                          thread.subscriptionStatus,
                          thread.subscriptionCurrentPeriodEnd,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {hasUnread ? (
                      <span
                        aria-label={`未読 ${thread.unreadCount} 件`}
                        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white"
                      >
                        {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                      </span>
                    ) : null}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRefundClick(thread)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          e.stopPropagation()
                          onRefundClick(thread)
                        }
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-100"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      返金
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AdminThreadConversation({
  adminUserId,
  adminNickname,
  thread,
  supabase,
  onAfterSend,
  onAfterDelete,
  hideThreadHeader = false,
}: {
  adminUserId: string
  adminNickname: string
  thread: GritvibAdminThreadSummary
  supabase: ReturnType<typeof getSupabaseBrowserClient>
  onAfterSend: () => void
  onAfterDelete: () => void
  /** スマホオーバーレイではシート側にヘッダーを出すため非表示 */
  hideThreadHeader?: boolean
}) {
  const threadMemberId = thread.memberId
  const initialThreadCache = useMemo(
    () => readAdminThreadCache(threadMemberId),
    [threadMemberId],
  )

  const [messages, setMessages] = useState<GritvibChatMessageView[]>(
    () => initialThreadCache ?? [],
  )
  const [loading, setLoading] = useState(() => initialThreadCache === null)
  const { getImageUrl, preloadFromMessages } = useGritvibChatImageUrls()
  usePreloadGritvibChatImages(messages, preloadFromMessages)
  const [draft, setDraft] = useState("")
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const imageLoadScrollKey = useMemo(
    () =>
      messages
        .map((m) => (m.imagePath ? getImageUrl(m.imagePath) ?? "pending" : ""))
        .join("|"),
    [messages, getImageUrl],
  )

  const scrollToBottom = useChatScrollToBottomOnOpen(listRef, {
    ready: !loading,
    messageCount: messages.length,
    resetKey: threadMemberId,
    layoutKey: imageLoadScrollKey,
  })

  useEffect(() => {
    if (loading) return
    writeAdminThreadCache(threadMemberId, messages)
  }, [threadMemberId, messages, loading])

  /** 選択スレッドの履歴を取得（キャッシュがあれば裏で同期）。 */
  useEffect(() => {
    let cancelled = false
    if (readAdminThreadCache(threadMemberId) === null) {
      setLoading(true)
    }
    void (async () => {
      const result = await fetchGritvibAdminThreadMessagesAction(threadMemberId)
      if (cancelled) return
      if (!result.ok) {
        safeClientLogError("[talk/admin] fetch thread failed")
        setMessages([])
        setLoading(false)
        return
      }
      setMessages(result.messages)
      writeAdminThreadCache(threadMemberId, result.messages)
      setLoading(false)
      scrollToBottom()
    })()
    return () => {
      cancelled = true
    }
  }, [threadMemberId, scrollToBottom])

  /** Realtime: 選択スレッドの INSERT / DELETE を購読。 */
  useEffect(() => {
    const channelId = `gritvib_chat_messages_admin:${threadMemberId}`
    const topic = `realtime:${channelId}`
    for (const existing of supabase.getChannels()) {
      if (existing.topic === topic) {
        void supabase.removeChannel(existing)
      }
    }

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gritvib_chat_messages",
          filter: `thread_member_id=eq.${threadMemberId}`,
        },
        (payload) => {
          const next = mapGritvibChatMessageRow(payload.new as GritvibChatMessageRow)
          setMessages((prev) => mergeGritvibChatMessageAfterRealtime(prev, next))
          scrollToBottom()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "gritvib_chat_messages",
          filter: `thread_member_id=eq.${threadMemberId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string } | null)?.id
          if (!removedId) return
          setMessages((prev) => prev.filter((m) => m.id !== removedId))
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          safeClientLogError("[talk/admin] thread realtime subscription failed")
        }
      })

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void (async () => {
        const result = await fetchGritvibAdminThreadMessagesAction(threadMemberId)
        if (result.ok) {
          setMessages((prev) =>
            reconcileGritvibChatMessagesFromServer(prev, result.messages),
          )
        }
      })()
    }, 5000)

    return () => {
      window.clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [supabase, threadMemberId, scrollToBottom])

  /** 添付画像の preview を Object URL で生成。 */
  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreview(null)
      return
    }
    const url = URL.createObjectURL(pendingImage)
    setPendingImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])

  const handleAttachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage("画像形式は JPEG / PNG / WebP / GIF にしてください。")
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setErrorMessage("画像は 5MB までです。")
      return
    }
    setErrorMessage(null)
    setPendingImage(file)
  }

  const handleClearPendingImage = () => {
    setPendingImage(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void submitMessage()
    }
  }

  const submitMessage = useCallback(async () => {
    if (isSending) return
    const trimmedBody = draft.trim()
    const imageFile = pendingImage
    if (trimmedBody.length === 0 && !imageFile) return
    if (trimmedBody.length > MESSAGE_BODY_MAX_LENGTH) {
      setErrorMessage(`メッセージは ${MESSAGE_BODY_MAX_LENGTH} 文字以内にしてください。`)
      return
    }

    const optimisticId = `pending-${crypto.randomUUID()}`
    let plannedImagePath: string | null = null
    let localImageUrl: string | undefined
    if (imageFile) {
      const ext = guessImageExtension(imageFile.type, imageFile.name)
      plannedImagePath = `${adminUserId}/${crypto.randomUUID()}.${ext}`
      localImageUrl = URL.createObjectURL(imageFile)
    }

    const optimistic = createOptimisticGritvibMessage({
      optimisticId,
      threadMemberId,
      senderRole: "operator",
      senderUserId: adminUserId,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      imagePath: plannedImagePath,
      localImageUrl,
    })

    setMessages((prev) => mergeGritvibChatMessage(prev, optimistic))
    setDraft("")
    setPendingImage(null)
    scrollToBottom()
    setErrorMessage(null)
    setIsSending(true)

    try {
      if (imageFile && plannedImagePath) {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(plannedImagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          })
        if (uploadError) {
          safeClientLogError("[talk/admin] upload failed")
          setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
          if (localImageUrl) URL.revokeObjectURL(localImageUrl)
          setErrorMessage("画像のアップロードに失敗しました。")
          return
        }
      }

      const result = await sendGritvibAdminMessageAction({
        threadMemberId,
        body: trimmedBody,
        imagePath: plannedImagePath,
      })

      if (!result.ok) {
        safeClientLogError("[talk/admin] send failed")
        setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
        if (localImageUrl) URL.revokeObjectURL(localImageUrl)
        if (plannedImagePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([plannedImagePath])
        }
        if (result.reason === "forbidden") {
          setErrorMessage("権限がありません。")
        } else if (result.reason === "not_found") {
          setErrorMessage("対象スレッドが見つかりませんでした。")
        } else if (result.reason === "body_too_long") {
          setErrorMessage(`メッセージは ${MESSAGE_BODY_MAX_LENGTH} 文字以内にしてください。`)
        } else if (result.reason === "empty_payload") {
          setErrorMessage("メッセージを入力してください。")
        } else {
          setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。")
        }
        return
      }

      setMessages((prev) => replaceOptimisticGritvibMessage(prev, optimisticId, result.message))
      scrollToBottom()
      onAfterSend()
    } catch (err) {
      safeClientLogError("[talk/admin] submit error")
      setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
      if (localImageUrl) URL.revokeObjectURL(localImageUrl)
      if (plannedImagePath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([plannedImagePath])
      }
      setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。")
    } finally {
      setIsSending(false)
    }
  }, [
    adminUserId,
    draft,
    isSending,
    pendingImage,
    scrollToBottom,
    supabase,
    threadMemberId,
    onAfterSend,
  ])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitMessage()
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId.startsWith("pending-")) return
    if (!confirm("このメッセージを削除しますか? 相手側からも見えなくなります。")) return
    const result = await deleteGritvibAdminMessageAction(messageId)
    if (!result.ok) {
      safeClientLogError("[talk/admin] delete failed")
      setErrorMessage("削除に失敗しました。時間をおいて再度お試しください。")
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    onAfterDelete()
  }

  const sendDisabled =
    isSending || (draft.trim().length === 0 && !pendingImage)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {hideThreadHeader ? null : (
        <div className="border-b border-zinc-200 px-4 py-3 text-sm">
          <p className="truncate font-medium text-black">{thread.nickname}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {describeGritvibChatSubscriptionStatus(
              thread.subscriptionStatus,
              thread.subscriptionCurrentPeriodEnd,
            )}
          </p>
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 [scrollbar-gutter:stable]"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              まだメッセージはありません。
            </p>
          ) : (
            messages.map((message) => (
              <TalkMessageBubble
                key={message.id}
                isMine={message.senderRole === "operator"}
                body={message.body}
                imagePath={message.imagePath}
                imageUrl={
                  message.localImageUrl ??
                  (message.imagePath ? getImageUrl(message.imagePath) : undefined)
                }
                pending={message.pending}
                onDelete={
                  message.senderRole === "operator" &&
                  message.senderUserId === adminUserId &&
                  !message.pending
                    ? () => handleDeleteMessage(message.id)
                    : undefined
                }
                footer={
                  !message.pending ? (
                    <p className="mt-1 text-right text-[10px] text-zinc-400">
                      {formatJa(message.createdAt)}
                    </p>
                  ) : null
                }
              />
            ))
          )}
        </div>
      </div>

      {errorMessage ? (
        <p
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-600"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {pendingImagePreview ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- ローカル preview */}
              <img
                src={pendingImagePreview}
                alt="送信予定の画像"
                className="max-h-32 max-w-[12rem] rounded-md border border-zinc-200 object-contain"
              />
              <button
                type="button"
                onClick={handleClearPendingImage}
                aria-label="画像を取り消す"
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAttachImage}
              disabled={isSending}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              aria-label="画像を添付"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
            </button>

            <TalkComposerTextarea
              value={draft}
              onChange={setDraft}
              onKeyDown={handleKeyDown}
              placeholder={`${adminNickname} として返信`}
              maxLength={MESSAGE_BODY_MAX_LENGTH}
            />

            <button
              type="submit"
              disabled={sendDisabled}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "送る"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function RefundModal({
  thread,
  onClose,
}: {
  thread: GritvibAdminThreadSummary
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [charges, setCharges] = useState<GritvibAdminCharge[] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await listGritvibAdminMemberChargesAction(thread.memberId)
    if (!result.ok) {
      if (result.reason === "no_customer") {
        setErrorMessage("この会員には Stripe Customer が紐づいていません。")
      } else if (result.reason === "stripe_not_configured") {
        setErrorMessage("決済情報を取得できません。しばらくしてからお試しください。")
      } else if (result.reason === "forbidden") {
        setErrorMessage("権限がありません。")
      } else if (result.reason === "not_found") {
        setErrorMessage("会員が見つかりませんでした。")
      } else {
        setErrorMessage("取引の取得に失敗しました。")
      }
      setCharges(null)
    } else {
      setCharges(result.charges)
    }
    setLoading(false)
  }, [thread.memberId])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Escape で閉じる + 背景スクロール抑制 */
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const handleRefund = async (charge: GritvibAdminCharge) => {
    if (!charge.paymentIntentId) {
      setErrorMessage("PaymentIntent ID が無いため返金できません。")
      return
    }
    if (
      !confirm(
        `この取引を全額返金しますか?\n金額: ${formatAmount(
          charge.amount,
          charge.currency,
        )}\n${charge.description ?? ""}`,
      )
    ) {
      return
    }
    setProcessingId(charge.chargeId)
    setInfoMessage(null)
    setErrorMessage(null)
    const result = await refundGritvibAdminChargeAction(charge.paymentIntentId)
    setProcessingId(null)
    if (!result.ok) {
      if (result.reason === "already_refunded") {
        setErrorMessage("この取引は既に返金済みです。")
      } else if (result.reason === "stripe_not_configured") {
        setErrorMessage("返金処理を実行できません。しばらくしてからお試しください。")
      } else if (result.reason === "forbidden") {
        setErrorMessage("権限がありません。")
      } else {
        setErrorMessage("返金に失敗しました。")
      }
      return
    }
    setInfoMessage("返金を作成しました。最新状態に更新します。")
    await reload()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${thread.nickname} の返金管理`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">返金管理</p>
            <p className="mt-0.5 truncate text-base font-medium text-black">
              {thread.nickname}
            </p>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              取引を取得中…
            </div>
          ) : errorMessage && !charges ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : !charges || charges.length === 0 ? (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
              返金可能な取引はありません。
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {charges.map((charge) => {
                const isFullyRefunded =
                  charge.refunded || charge.refundedAmount >= charge.amount
                return (
                  <li
                    key={charge.chargeId}
                    className="rounded-lg border border-zinc-200 px-3 py-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-black">
                          {formatAmount(charge.amount, charge.currency)}
                          {charge.refundedAmount > 0 ? (
                            <span className="ml-2 text-xs text-zinc-500">
                              (返金済 {formatAmount(charge.refundedAmount, charge.currency)})
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {formatJa(new Date(charge.created * 1000).toISOString())} ·{" "}
                          {charge.status}
                        </p>
                        {charge.description ? (
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {charge.description}
                          </p>
                        ) : null}
                        <p className="mt-0.5 truncate text-[10px] text-zinc-400">
                          {charge.chargeId}
                          {charge.paymentIntentId ? ` · ${charge.paymentIntentId}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {charge.receiptUrl ? (
                          <a
                            href={charge.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-zinc-500 underline-offset-4 hover:underline"
                          >
                            領収書
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleRefund(charge)}
                          disabled={
                            isFullyRefunded ||
                            processingId === charge.chargeId ||
                            !charge.paymentIntentId
                          }
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-black px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                        >
                          {processingId === charge.chargeId ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : null}
                          {isFullyRefunded ? "返金済" : "返金"}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {infoMessage ? (
            <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              {infoMessage}
            </p>
          ) : null}
          {errorMessage && charges ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-xs text-zinc-500">
          <span>全額返金のみ対応します。</span>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-zinc-300 px-3 text-xs text-zinc-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            更新
          </button>
        </footer>
      </div>
    </div>
  )
}
