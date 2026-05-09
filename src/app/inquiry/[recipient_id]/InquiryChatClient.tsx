"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { InquiryInboxList, type InquiryPeerProfile } from "@/components/inquiry/InquiryInboxList"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { buildProfilePath } from "@/lib/profile-path"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import {
  fetchInquiryInboxList,
  fetchInquiryThreadMessages,
  insertInquiryMessage,
  markInquiryThreadRead,
  type InquiryInboxListRow,
  type InquiryMessageRow,
} from "@/lib/inquiry-messages"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"
import { normalizeSkillBigIntId, uniqueSkillBigIntIds } from "@/lib/skill-id-bigint"
import { fetchConsultationChatEnabled } from "@/lib/consultation"
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SkillHeaderRow = {
  id: string
  user_id: string
  title: string
  price: number
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
  const thumb = detail ? resolveSkillThumbnailUrl(detail.thumbnail_url) : resolveSkillThumbnailUrl(null)
  const purchaseHref =
    detail != null && userId != null && detail.user_id !== userId
      ? `/skills/${encodeURIComponent(skillId)}`
      : null

  return (
    <li className="list-none" aria-label="相談スキル">
      <div
        className={`mx-auto max-w-lg rounded-xl border px-3 py-3 ${
          source === "nav_pending"
            ? "border-amber-500/35 bg-amber-950/25"
            : "border-red-500/25 bg-zinc-900/80"
        }`}
      >
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {source === "nav_pending" ? "こちらのスキルについて相談" : "相談スキル"}
        </p>
        {!detail ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red-500" aria-hidden />
            スキル情報を読み込み中…
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
              <Image src={thumb} alt="" fill className="object-cover" sizes="96px" unoptimized />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full border border-red-500/35 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-200">
                {detail.category}
              </span>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{detail.title}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                ¥{Number(detail.price ?? 0).toLocaleString()} / 回
              </p>
              {purchaseHref ? (
                <Button
                  asChild
                  size="sm"
                  className="mt-2 h-8 bg-red-600 text-xs font-bold text-white hover:bg-red-500"
                >
                  <Link href={purchaseHref}>このスキルで取引を始める（購入ページへ）</Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {source === "nav_pending" ? (
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            下の送信欄から送るメッセージは、このスキルについての相談として届きます。
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
  const initialScrollDoneRef = useRef(false)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const forceScrollToBottom = useCallback(() => {
    const el = messagesScrollRef.current
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
      setMessagesError(error)
    } else {
      setMessages(rows)
      const { error: readErr } = await markInquiryThreadRead(supabase, userId, peerId)
      if (readErr) {
        console.warn("[inquiry] mark read", readErr)
        setReadStatusError(`既読更新に失敗しました: ${readErr}`)
      }
    }
    setMessagesLoading(false)
  }, [supabase, userId, peerId])

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
        .select("id, user_id, title, price, category, thumbnail_url")
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

  useEffect(() => {
    if (preChatGuardPending || messagesLoading || initialScrollDoneRef.current || inquiryTimeline.length === 0) {
      return
    }
    if (!messagesScrollRef.current) {
      return
    }
    const el = messagesScrollRef.current
    const raf1 = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
      const raf2 = requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
        const timeoutId = window.setTimeout(() => {
          el.scrollTop = el.scrollHeight
          initialScrollDoneRef.current = true
        }, 80)
        void timeoutId
      })
      void raf2
    })
    return () => {
      cancelAnimationFrame(raf1)
    }
  }, [preChatGuardPending, messagesLoading, inquiryTimeline.length, skillIdsLoadKey, skillIdFromQuery, peerId])

  const peerProfile = peerProfiles[peerId]
  const peerName = peerProfile?.display_name?.trim() || "ユーザー"

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

    const maybeRefreshForThread = (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const sid = String(payload.new.sender_id ?? payload.old.sender_id ?? "")
      const rid = String(payload.new.recipient_id ?? payload.old.recipient_id ?? "")
      const hasPair = sid.length > 0 && rid.length > 0
      const inThread = hasPair
        ? (sid === userId && rid === peerId) || (sid === peerId && rid === userId)
        : true
      if (!inThread) {
        return
      }
      void loadMessages()
      void loadInbox()
    }

    const ch = supabase
      .channel(`inquiry-dm:${userId}:${peerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_messages" },
        (payload) => {
          maybeRefreshForThread({
            new: (payload.new as Record<string, unknown>) ?? {},
            old: (payload.old as Record<string, unknown>) ?? {},
          })
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiry_messages" },
        (payload) => {
          maybeRefreshForThread({
            new: (payload.new as Record<string, unknown>) ?? {},
            old: (payload.old as Record<string, unknown>) ?? {},
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [userId, peerId, supabase, loadMessages, loadInbox])

  const handleSend = async () => {
    if (!userId || !isUuid(peerId) || peerId === userId) {
      return
    }
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }
    if (effectiveOriginSkillId == null) {
      setSendError("相談対象のスキルを特定できません。スキルページから「出品者に質問する」で開き直してください。")
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
      setSendError(error ?? "送信に失敗しました。")
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    const path = `/inquiry/${encodeURIComponent(peerId)}`
    const qs = searchParams.toString()
    const full = qs ? `${path}?${qs}` : path
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-100">
        <p className="text-center text-sm text-zinc-300">相談チャットを開くにはログインが必要です。</p>
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-500"
          onClick={() => router.replace(`/login?redirect=${encodeURIComponent(full)}`)}
        >
          ログインへ
        </Button>
      </div>
    )
  }

  if (!isUuid(peerId)) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-zinc-200">
        <p className="text-sm text-zinc-400">URL が不正です。</p>
        <Button asChild className="mt-6 bg-red-600 text-white hover:bg-red-500">
          <Link href="/inquiry/list">一覧へ</Link>
        </Button>
      </div>
    )
  }

  if (peerId === userId) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center text-zinc-200">
        <p className="text-sm text-zinc-400">自分自身とはチャットできません。</p>
        <Button asChild className="mt-6 bg-red-600 text-white hover:bg-red-500">
          <Link href="/inquiry/list">一覧へ</Link>
        </Button>
      </div>
    )
  }

  if (preChatGuardPending) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <p className="text-sm text-zinc-400">相談設定を確認しています…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <div className="mx-auto flex max-h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] max-w-6xl flex-col md:flex-row md:border-x md:border-zinc-800">
        <aside className="hidden w-full max-w-sm shrink-0 flex-col border-zinc-800 md:flex md:border-r">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-zinc-200">相談一覧</h2>
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
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2 md:px-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => router.push("/inquiry/list")}
              aria-label="一覧へ戻る"
            >
              <ArrowLeft className="h-5 w-5 text-zinc-300" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-500">相手</p>
              <p className="truncate text-sm font-semibold text-white">{peerName}</p>
            </div>
          </div>

          <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-4">
            {messagesLoading ? (
              <div className="flex justify-center py-12 text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              </div>
            ) : messagesError ? (
              <p className="text-center text-sm text-red-400">{messagesError}</p>
            ) : inquiryTimeline.length === 0 ? (
              <p className="text-center text-sm text-zinc-500">
                メッセージはまだありません。スキル詳細の「出品者に質問する」から開くか、下の欄から送信してください。
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
                      ? "自分"
                      : isPeerSender
                        ? peerName
                        : senderProfile?.display_name?.trim() || "ユーザー"
                    const avatarSrc = resolveProfileAvatarUrl(
                      mine ? myProfile?.avatar_url ?? null : isPeerSender ? peerProfile?.avatar_url ?? null : senderProfile?.avatar_url ?? null,
                      label,
                    )
                    const senderProfilePath = buildProfilePath(m.sender_id, senderProfile?.custom_id ?? null)
                    return (
                      <li key={m.id}>
                        {mine ? (
                          <div className="flex w-full justify-end">
                            <div className="flex min-w-0 max-w-[85%] flex-col items-end gap-1">
                              <p className="max-w-full truncate px-1 text-xs text-zinc-500">{label}</p>
                              <div className="rounded-2xl bg-red-900/50 px-3 py-2 text-sm leading-relaxed text-red-50">
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p className="mt-1 text-[10px] opacity-70">
                                  {new Date(m.created_at).toLocaleString("ja-JP", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {m.is_read ? " · 既読" : " · 未読"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex w-full items-start justify-start gap-2">
                            <Link
                              href={senderProfilePath}
                              className="shrink-0"
                              aria-label={`${label}のプロフィールへ`}
                            >
                              <div className="relative h-9 w-9 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                                <Image src={avatarSrc} alt="" fill className="object-cover" sizes="36px" unoptimized />
                              </div>
                            </Link>
                            <div className="min-w-0 max-w-[calc(100%-2.75rem)]">
                              <p className="mb-1 truncate text-xs text-zinc-400">{label}</p>
                              <div className="rounded-2xl bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-100">
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <p className="mt-1 text-[10px] opacity-70">
                                  {new Date(m.created_at).toLocaleString("ja-JP", {
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
                  <p className="mt-4 text-center text-sm text-zinc-500">
                    メッセージはまだありません。下の欄から送信してください。
                  </p>
                ) : null}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 p-3 md:p-4">
            {sendError ? <p className="mb-2 text-center text-xs text-red-400">{sendError}</p> : null}
            {readStatusError ? <p className="mb-2 text-center text-xs text-amber-300">{readStatusError}</p> : null}
            <div className="flex gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="メッセージを入力..."
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <Button
                type="button"
                disabled={sending || effectiveOriginSkillId == null}
                onClick={() => void handleSend()}
                className="h-auto shrink-0 self-end bg-red-600 px-4 font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "送信"}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-zinc-600">
              取引成立後のやり取りはスキル購入後に生成される専用の取引チャットをご利用ください。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
