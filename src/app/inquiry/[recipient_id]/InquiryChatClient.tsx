"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { ChatComposerTextarea } from "@/components/chat/ChatComposerTextarea"
import { useChatScrollToBottomOnOpen } from "@/lib/use-chat-scroll-to-bottom-on-open"
import { Button } from "@/components/ui/button"
import { InquiryInboxList, type InquiryPeerProfile } from "@/components/inquiry/InquiryInboxList"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { safeClientLogError } from "@/lib/safe-client-log"
import { buildStorePath } from "@/lib/profile-path"
import { ProfileAvatar } from "@/components/profile-avatar"
import {
  fetchInquiryInboxList,
  fetchInquiryThreadMessages,
  insertInquiryMessage,
  mapInquiryMessageRow,
  markInquiryThreadRead,
  type InquiryInboxListRow,
  type InquiryMessageRow,
} from "@/lib/inquiry-messages"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"
import { normalizeSkillBigIntId, uniqueSkillBigIntIds } from "@/lib/skill-id-bigint"
import { fetchConsultationChatEnabled } from "@/lib/consultation"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"
import { formatCurrencyPlain, normalizeCurrency } from "@/lib/currency"
import { localeToHtmlLang } from "@/lib/i18n/locales"
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SkillHeaderRow = {
  id: string
  user_id: string
  title: string
  price: number
  /** 行の販売通貨。未指定（古い SELECT・古い行）は 'JPY' フォールバック */
  currency?: string | null
  category: string
  thumbnail_url: string | null
}

type InquiryTimelineItem =
  | { kind: "skill_context"; skillId: string; source: "thread" | "nav_pending"; key: string }
  | { kind: "message"; message: InquiryMessageRow }

function mapRecordToSkillHeader(rec: Record<string, unknown>): SkillHeaderRow | null {
  const sid = normalizeSkillBigIntId(rec.id)
  if (sid == null) {
    return null
  }
  return {
    id: sid,
    user_id: String(rec.user_id ?? ""),
    title: String(rec.title ?? ""),
    price: Number(rec.price ?? 0),
    category: String(rec.category ?? ""),
    thumbnail_url: (rec.thumbnail_url as string | null) ?? null,
  }
}

function inquiryMessageIdKey(id: string): string {
  return id
}

function mergeInquiryMessageRow(prev: InquiryMessageRow[], row: InquiryMessageRow): InquiryMessageRow[] {
  const key = inquiryMessageIdKey(row.id)
  if (prev.some((m) => inquiryMessageIdKey(m.id) === key)) {
    return prev
  }
  return [...prev, row].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

function applyInquiryMessageUpdate(prev: InquiryMessageRow[], row: InquiryMessageRow): InquiryMessageRow[] {
  const key = inquiryMessageIdKey(row.id)
  const idx = prev.findIndex((m) => inquiryMessageIdKey(m.id) === key)
  if (idx === -1) {
    return mergeInquiryMessageRow(prev, row)
  }
  const next = [...prev]
  next[idx] = row
  return next
}

function isInquiryThreadPair(
  row: Pick<InquiryMessageRow, "sender_id" | "recipient_id">,
  userId: string,
  peerId: string,
): boolean {
  return (
    (row.sender_id === userId && row.recipient_id === peerId) ||
    (row.sender_id === peerId && row.recipient_id === userId)
  )
}

function buildInquiryTimeline(messages: InquiryMessageRow[], skillIdFromQuery: string | null): InquiryTimelineItem[] {
  const items: InquiryTimelineItem[] = []
  let prevSkill: string | null = null
  for (const m of messages) {
    const sid = m.origin_skill_id
    if (sid !== prevSkill) {
      items.push({
        kind: "skill_context",
        skillId: sid,
        source: "thread",
        key: `ctx-${m.id}-${sid}`,
      })
      prevSkill = sid
    }
    items.push({ kind: "message", message: m })
  }
  const lastSkill = messages.length > 0 ? messages[messages.length - 1].origin_skill_id : null
  if (skillIdFromQuery != null && skillIdFromQuery !== lastSkill) {
    items.push({
      kind: "skill_context",
      skillId: skillIdFromQuery,
      source: "nav_pending",
      key: `nav-${skillIdFromQuery}`,
    })
  }
  return items
}

function InquirySkillContextBlock({
  skillId,
  detail,
  userId,
  source,
}: {
  skillId: string
  detail: SkillHeaderRow | undefined
  userId: string | null
  source: "thread" | "nav_pending"
}) {
  const t = useTranslations("inquiry")
  const thumb = detail ? resolveSkillThumbnailUrl(detail.thumbnail_url) : resolveSkillThumbnailUrl(null)
  const purchaseHref =
    detail != null && userId != null && detail.user_id !== userId
      ? `/skills/${encodeURIComponent(skillId)}`
      : null

  return (
    <li className="list-none" aria-label={t("contextLabelDefault")}>
      <div
        className={`mx-auto max-w-lg rounded-xl border px-3 py-3 ${
          source === "nav_pending"
            ? "border-amber-500/35 bg-amber-950/25"
            : "border-red-500/25 bg-muted/50"
        }`}
      >
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {source === "nav_pending" ? t("contextLabelPending") : t("contextLabelDefault")}
        </p>
        {!detail ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red-500" aria-hidden />
            {t("skillInfoLoading")}
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image src={thumb} alt="" fill className="object-cover" sizes="96px" unoptimized />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full border border-red-500/35 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-200">
                {detail.category}
              </span>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{detail.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("priceLine", {
                  amount: formatCurrencyPlain(Number(detail.price ?? 0), normalizeCurrency(detail.currency)),
                })}
              </p>
              {purchaseHref ? (
                <Button
                  asChild
                  size="sm"
                  className="mt-2 h-8 bg-red-600 text-xs font-bold text-white hover:bg-red-500"
                >
                  <Link href={purchaseHref}>{t("openPurchaseCta")}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {source === "nav_pending" ? (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {t("pendingContextHint")}
          </p>
        ) : null}
      </div>
    </li>
  )
}

type InquiryPeerProfileWithCustomId = InquiryPeerProfile & { custom_id: string | null }

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function InquiryChatClient() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("inquiry")
  const locale = useLocale()
  const htmlLang = localeToHtmlLang(locale)

  const peerRaw =
    typeof params.recipient_id === "string" ? params.recipient_id : params.recipient_id?.[0] ?? ""
  const peerId = peerRaw.trim()

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [threads, setThreads] = useState<InquiryInboxListRow[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [peerProfiles, setPeerProfiles] = useState<Record<string, InquiryPeerProfileWithCustomId>>({})
  const [skillTitles, setSkillTitles] = useState<Record<string, string>>({})

  const [messages, setMessages] = useState<InquiryMessageRow[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [readStatusError, setReadStatusError] = useState<string | null>(null)
  const [senderProfiles, setSenderProfiles] = useState<Record<string, InquiryPeerProfileWithCustomId>>({})
  const [myProfile, setMyProfile] = useState<InquiryPeerProfileWithCustomId | null>(null)

  const [skillDetailById, setSkillDetailById] = useState<Record<string, SkillHeaderRow>>({})
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const skillIdFromQuery = useMemo(() => {
    const raw = searchParams.get("skill_id")
    return normalizeSkillBigIntId(raw)
  }, [searchParams])

  const [preChatGuardPending, setPreChatGuardPending] = useState(() => Boolean(skillIdFromQuery))

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    setInboxError(null)
    const { rows, error } = await fetchInquiryInboxList(supabase)
    if (error) {
      setThreads([])
      setInboxError(error)
      setInboxLoading(false)
      return
    }
    setThreads(rows)

    const peerIds = [...new Set(rows.map((r) => r.peer_id))]
    const skillIds = uniqueSkillBigIntIds(rows.map((r) => r.last_origin_skill_id))

    if (peerIds.length > 0) {
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, custom_id")
        .in("id", peerIds)
      const nextProf: Record<string, InquiryPeerProfileWithCustomId> = {}
      for (const row of (profData ?? []) as {
        id: string
        display_name: string | null
        avatar_url: string | null
        custom_id: string | null
      }[]) {
        nextProf[row.id] = { display_name: row.display_name, avatar_url: row.avatar_url, custom_id: row.custom_id }
      }
      setPeerProfiles(nextProf)
    } else {
      setPeerProfiles({})
    }

    if (skillIds.length > 0) {
      const { data: skillData } = await supabase.from("skills").select("id, title").in("id", skillIds)
      const nextTitles: Record<string, string> = {}
      for (const row of skillData ?? []) {
        const rec = row as { id: unknown; title: unknown }
        const sid = normalizeSkillBigIntId(rec.id)
        if (sid != null) {
          nextTitles[sid] = String(rec.title ?? "")
        }
      }
      setSkillTitles(nextTitles)
    } else {
      setSkillTitles({})
    }

    setInboxLoading(false)
  }, [supabase])

  const loadMessages = useCallback(async () => {
    if (!userId || !isUuid(peerId) || peerId === userId) {
      setMessages([])
      setMessagesLoading(false)
      return
    }
    setMessagesLoading(true)
    setMessagesError(null)
    setReadStatusError(null)
    const { rows, error } = await fetchInquiryThreadMessages(supabase, peerId)
    if (error) {
      setMessages([])
      setMessagesError(t("messagesLoadFailed"))
    } else {
      setMessages(rows)
    }
    setMessagesLoading(false)
  }, [supabase, userId, peerId])

  const markPeerInquiryAsRead = useCallback(async () => {
    if (!userId || !isUuid(peerId) || peerId === userId) {
      return
    }
    const { error: readErr } = await markInquiryThreadRead(supabase, userId, peerId)
    if (readErr) {
      setReadStatusError(t("readUpdateFailedGeneric"))
      return
    }
    setReadStatusError(null)
    setMessages((prev) =>
      prev.map((m) =>
        m.recipient_id === userId && m.sender_id === peerId && !m.is_read ? { ...m, is_read: true } : m,
      ),
    )
  }, [supabase, userId, peerId, t])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user) {
        setUserId(null)
        setAuthLoading(false)
        return
      }
      setUserId(data.user.id)
      setAuthLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (userId) {
      void loadInbox()
    }
  }, [userId, loadInbox])

  useEffect(() => {
    if (!userId) {
      setMyProfile(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, custom_id")
        .eq("id", userId)
        .maybeSingle()
      if (cancelled || !data) {
        return
      }
      const row = data as { display_name: string | null; avatar_url: string | null; custom_id: string | null }
      setMyProfile({ display_name: row.display_name, avatar_url: row.avatar_url, custom_id: row.custom_id })
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (messagesLoading || !userId) {
      return
    }
    void markPeerInquiryAsRead()
  }, [messagesLoading, userId, markPeerInquiryAsRead])

  useEffect(() => {
    initialScrollDoneRef.current = false
  }, [peerId, skillIdFromQuery])

  useEffect(() => {
    if (!messages.length) {
      return
    }
    const senderIds = [...new Set(messages.map((m) => m.sender_id).filter((id) => id.trim().length > 0))]
    if (!senderIds.length) {
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, custom_id")
        .in("id", senderIds)
      if (cancelled || error || !data) {
        return
      }
      setSenderProfiles((prev) => {
        const next = { ...prev }
        for (const row of data as {
          id: string
          display_name: string | null
          avatar_url: string | null
          custom_id: string | null
        }[]) {
          next[row.id] = { display_name: row.display_name, avatar_url: row.avatar_url, custom_id: row.custom_id }
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [messages, supabase])

  useEffect(() => {
    if (!skillIdFromQuery) {
      setPreChatGuardPending(false)
      return
    }
    if (!userId || !isUuid(peerId) || peerId === userId) {
      return
    }

    let cancelled = false
    setPreChatGuardPending(true)

    void (async () => {
      const { data: sk, error } = await supabase
        .from("skills")
        .select("user_id")
        .eq("id", skillIdFromQuery)
        .maybeSingle()
      if (cancelled) {
        return
      }
      if (error || !sk) {
        router.replace("/inquiry/list")
        return
      }
      const ownerId = String((sk as { user_id: string }).user_id)
      const skillInvolvesThread = ownerId === peerId || ownerId === userId
      if (!skillInvolvesThread) {
        router.replace(`/skills/${encodeURIComponent(skillIdFromQuery)}`)
        return
      }
      const enabled = await fetchConsultationChatEnabled(supabase, skillIdFromQuery)
      if (cancelled) {
        return
      }
      if (!enabled) {
        router.replace(`/skills/${encodeURIComponent(skillIdFromQuery)}`)
        return
      }
      setPreChatGuardPending(false)
    })()

    return () => {
      cancelled = true
    }
  }, [skillIdFromQuery, userId, peerId, supabase, router])

  /** スキル詳細の「質問する」や一覧の ?skill_id= を最優先（別商品から開いた文脈を維持） */
  const effectiveOriginSkillId = useMemo((): string | null => {
    if (skillIdFromQuery != null) {
      return skillIdFromQuery
    }
    if (messages.length > 0) {
      return messages[messages.length - 1]?.origin_skill_id ?? null
    }
    return null
  }, [messages, skillIdFromQuery])

  const inquiryTimeline = useMemo(
    () => buildInquiryTimeline(messages, skillIdFromQuery),
    [messages, skillIdFromQuery],
  )

  const skillIdsToLoad = useMemo(() => {
    const ids = new Set<string>()
    for (const item of inquiryTimeline) {
      if (item.kind === "skill_context") {
        ids.add(item.skillId)
      }
    }
    if (effectiveOriginSkillId) {
      ids.add(effectiveOriginSkillId)
    }
    return [...ids]
  }, [inquiryTimeline, effectiveOriginSkillId])

  const skillIdsLoadKey = useMemo(() => [...skillIdsToLoad].sort().join(","), [skillIdsToLoad])

  const scrollToBottom = useChatScrollToBottomOnOpen(messagesScrollRef, {
    ready: !preChatGuardPending && !messagesLoading,
    messageCount: inquiryTimeline.length,
    resetKey: peerId,
    layoutKey: skillIdsLoadKey,
  })

  const forceScrollToBottom = useCallback(() => {
    scrollToBottom()
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
  }, [scrollToBottom])

  useEffect(() => {
    if (!skillIdsLoadKey) {
      return
    }
    const ids = skillIdsLoadKey.split(",").filter((s) => s.length > 0)
    if (ids.length === 0) {
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from("skills")
        .select("id, user_id, title, price, currency, category, thumbnail_url")
        .in("id", ids)
      if (cancelled || error || !data) {
        return
      }
      setSkillDetailById((prev) => {
        const next = { ...prev }
        for (const row of data as Record<string, unknown>[]) {
          const mapped = mapRecordToSkillHeader(row)
          if (mapped) {
            next[mapped.id] = mapped
          }
        }
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, skillIdsLoadKey])

  const peerProfile = peerProfiles[peerId]
  const peerName = peerProfile?.display_name?.trim() || t("anonymousUser")

  useEffect(() => {
    if (!peerId || !isUuid(peerId) || peerProfile) {
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, custom_id")
        .eq("id", peerId)
        .maybeSingle()
      if (cancelled || !data) {
        return
      }
      const row = data as { id: string; display_name: string | null; avatar_url: string | null; custom_id: string | null }
      setPeerProfiles((prev) => ({
        ...prev,
        [row.id]: { display_name: row.display_name, avatar_url: row.avatar_url, custom_id: row.custom_id },
      }))
    })()
    return () => {
      cancelled = true
    }
  }, [peerId, peerProfile, supabase])

  useEffect(() => {
    if (!userId || !isUuid(peerId) || peerId === userId) {
      return
    }

    const handleRealtimePayload = (payload: { eventType: string; new: unknown; old: unknown }) => {
      if (payload.eventType === "INSERT") {
        const row = mapInquiryMessageRow((payload.new as Record<string, unknown>) ?? {})
        if (!row || !isInquiryThreadPair(row, userId, peerId)) {
          return
        }
        setMessages((prev) => mergeInquiryMessageRow(prev, row))
        if (row.recipient_id === userId) {
          void markPeerInquiryAsRead()
        }
        void loadInbox()
        return
      }

      if (payload.eventType === "UPDATE") {
        const row = mapInquiryMessageRow((payload.new as Record<string, unknown>) ?? {})
        if (!row || !isInquiryThreadPair(row, userId, peerId)) {
          return
        }
        setMessages((prev) => applyInquiryMessageUpdate(prev, row))
        if (row.sender_id === userId) {
          void loadInbox()
        }
      }
    }

    const ch = supabase
      .channel(`inquiry-dm:${userId}:${peerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_messages" },
        handleRealtimePayload,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiry_messages" },
        handleRealtimePayload,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          safeClientLogError("[inquiry] inquiry_messages realtime subscription failed")
        }
      })

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [userId, peerId, supabase, markPeerInquiryAsRead, loadInbox])

  const handleSend = async () => {
    if (!userId || !isUuid(peerId) || peerId === userId) {
      return
    }
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    if (effectiveOriginSkillId == null) {
      setSendError(t("missingSkillError"))
      return
    }

    setSendError(null)
    setSending(true)
    const { row, error } = await insertInquiryMessage(supabase, {
      sender_id: userId,
      recipient_id: peerId,
      origin_skill_id: effectiveOriginSkillId,
      content: trimmed,
    })
    setSending(false)
    if (error || !row) {
      setSendError(t("sendFailedFallback"))
      return
    }
    setText("")
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
    forceScrollToBottom()
    void loadInbox()
    void fetch("/api/notifications/inquiry-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: row.id }),
    }).catch(() => {
      // メール通知失敗でチャット送信を失敗扱いにしない
    })
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    const path = `/inquiry/${encodeURIComponent(peerId)}`
    const qs = searchParams.toString()
    const full = qs ? `${path}?${qs}` : path
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
        <p className="text-center text-sm text-muted-foreground">{t("loginToOpenChat")}</p>
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-500"
          onClick={() => router.replace(`/login?redirect=${encodeURIComponent(full)}`)}
        >
          {t("loginCta")}
        </Button>
      </div>
    )
  }

  if (!isUuid(peerId)) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 text-center text-muted-foreground">
        <p className="text-sm text-muted-foreground">{t("invalidUrl")}</p>
        <Button asChild className="mt-6 bg-red-600 text-white hover:bg-red-500">
          <Link href="/inquiry/list">{t("listLink")}</Link>
        </Button>
      </div>
    )
  }

  if (peerId === userId) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 text-center text-muted-foreground">
        <p className="text-sm text-muted-foreground">{t("selfChatForbidden")}</p>
        <Button asChild className="mt-6 bg-red-600 text-white hover:bg-red-500">
          <Link href="/inquiry/list">{t("listLink")}</Link>
        </Button>
      </div>
    )
  }

  if (preChatGuardPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("preChatChecking")}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] max-w-6xl flex-col md:flex-row md:border-x md:border-border">
        <aside className="hidden w-full max-w-sm shrink-0 flex-col border-border md:flex md:border-r">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">{t("inboxHeading")}</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <InquiryInboxList
              threads={threads}
              peerProfiles={peerProfiles}
              skillTitles={skillTitles}
              loading={inboxLoading}
              error={inboxError}
              activePeerId={peerId}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 md:px-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => router.push("/inquiry/list")}
              aria-label={t("backToListAria")}
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
            <ProfileAvatar
              avatarUrl={peerProfile?.avatar_url ?? null}
              alt={peerName}
              className="h-10 w-10 shrink-0 border border-border"
              sizes="40px"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">{t("peerLabel")}</p>
              <p className="truncate text-sm font-semibold text-white">{peerName}</p>
            </div>
          </div>

          <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4">
            {messagesLoading ? (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              </div>
            ) : messagesError ? (
              <p className="text-center text-sm text-red-400">{messagesError}</p>
            ) : inquiryTimeline.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                {t("noMessagesWithCta")}
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {inquiryTimeline.map((item) => {
                    if (item.kind === "skill_context") {
                      return (
                        <InquirySkillContextBlock
                          key={item.key}
                          skillId={item.skillId}
                          detail={skillDetailById[item.skillId]}
                          userId={userId}
                          source={item.source}
                        />
                      )
                    }
                    const m = item.message
                    const mine = m.sender_id === userId
                    const senderProfile = senderProfiles[m.sender_id]
                    const isPeerSender = m.sender_id === peerId
                    const label = mine
                      ? t("selfLabel")
                      : isPeerSender
                        ? peerName
                        : senderProfile?.display_name?.trim() || t("anonymousUser")
                    const messageAvatarUrl = mine
                      ? myProfile?.avatar_url ?? null
                      : isPeerSender
                        ? peerProfile?.avatar_url ?? null
                        : senderProfile?.avatar_url ?? null
                    const senderProfilePath = buildStorePath(m.sender_id, senderProfile?.custom_id ?? null)
                    return (
                      <li key={m.id}>
                        {mine ? (
                          <div className="flex w-full justify-end">
                            <div className="flex min-w-0 max-w-[85%] flex-col items-end gap-1">
                              <p className="max-w-full truncate px-1 text-xs text-muted-foreground">{label}</p>
                              <div className="rounded-2xl bg-red-900/50 px-3 py-2 text-sm leading-relaxed text-red-50">
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p className="mt-1 text-[10px] opacity-70">
                                  {new Date(m.created_at).toLocaleString(htmlLang, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {m.is_read ? t("readMarkSeparator") : t("unreadMarkSeparator")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex w-full items-start justify-start gap-2">
                            <Link
                              href={senderProfilePath}
                              className="shrink-0"
                              aria-label={t("viewProfileAria", { name: label })}
                            >
                              <ProfileAvatar
                                avatarUrl={messageAvatarUrl}
                                alt={label}
                                className="h-9 w-9 border border-border"
                                sizes="36px"
                              />
                            </Link>
                            <div className="min-w-0 max-w-[calc(100%-2.75rem)]">
                              <p className="mb-1 truncate text-xs text-muted-foreground">{label}</p>
                              <div className="rounded-2xl bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p className="mt-1 text-[10px] opacity-70">
                                  {new Date(m.created_at).toLocaleString(htmlLang, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {messages.length === 0 ? (
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {t("noMessagesSimple")}
                  </p>
                ) : null}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card p-3 md:p-4">
            {sendError ? <p className="mb-2 text-center text-xs text-red-400">{sendError}</p> : null}
            {readStatusError ? <p className="mb-2 text-center text-xs text-amber-300">{readStatusError}</p> : null}
            <div className="flex items-end gap-2">
              <ChatComposerTextarea
                value={text}
                onChange={setText}
                placeholder={t("composerPlaceholder")}
                disabled={sending || effectiveOriginSkillId == null}
                onSubmit={() => void handleSend()}
                className="focus:border-red-500 focus:ring-red-500/25"
              />
              <Button
                type="button"
                disabled={sending || effectiveOriginSkillId == null}
                onClick={() => void handleSend()}
                className="mb-0.5 h-auto shrink-0 bg-red-600 px-4 font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sendButton")}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
              {t("purchaseChatNote")}
              <span className="hidden md:inline">
                <br />
                {t("keyboardHint")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
