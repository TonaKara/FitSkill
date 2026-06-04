"use server"

import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireGritvibAdminUser } from "@/lib/talk/admin-auth"
import { mapGritvibChatMessageRow } from "@/lib/talk/gritvib-chat-message"

/**
 * GritVib 管理画面 (運営オペレーター用) の Server Actions。
 *
 * 提供:
 *   - `listGritvibAdminThreadsAction`: 会員一覧 (ニックネーム / 最新メッセージ / サブスク状態)
 *   - `fetchGritvibAdminThreadMessagesAction`: 個別スレッドの全メッセージ
 *   - `sendGritvibAdminMessageAction`: operator 名義での送信 (テキスト or 画像)
 *   - `deleteGritvibAdminMessageAction`: 自分 (operator) が送ったメッセージのみ削除
 *   - `markGritvibAdminThreadReadAction`: スレッドを開いた時刻を DB に保存（既読）
 *
 * 認可:
 *   - すべて冒頭で `requireGritvibAdminUser` を呼び、admin 以外は弾く。
 *   - 一覧 / 個別取得 / メール取得は `getSupabaseAdminClient` (service role) 経由。
 *     呼び出し前に `requireGritvibAdminUser` で admin を確認する。
 *   - 送信は admin ユーザーの session で行う (RLS の operator 用 INSERT policy が許可する)。
 */

const MESSAGE_BODY_MAX_LENGTH = 2000

export type GritvibAdminThreadSummary = {
  memberId: string
  nickname: string
  subscriptionStatus: string
  subscriptionCurrentPeriodEnd: string | null
  stripeCustomerId: string | null
  memberCreatedAt: string
  lastMessageAt: string | null
  lastMessageBody: string | null
  lastMessageHasImage: boolean
  lastMessageSenderRole: "member" | "operator" | null
  /**
   * 未読件数 = 最後の operator 返信より後、かつ運営がスレッドを開いた read_at より後の member メッセージ数。
   */
  unreadCount: number
  /**
   * 未読の中で最も古いメッセージの created_at (ISO)。
   * 「一番待たせている人」を一覧の上に並べる際のソートキー。
   * 未読が無いスレッドは null。
   */
  oldestUnreadAt: string | null
}

export type GritvibAdminMessage = {
  id: string
  threadMemberId: string
  senderRole: "member" | "operator"
  senderUserId: string
  body: string | null
  imagePath: string | null
  createdAt: string
}

type ListThreadsResult =
  | { ok: true; threads: GritvibAdminThreadSummary[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "internal" }

type FetchMessagesResult =
  | { ok: true; messages: GritvibAdminMessage[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "internal" }

type SendAdminMessageResult =
  | { ok: true; message: GritvibAdminMessage }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "empty_payload"
        | "body_too_long"
        | "invalid_image_path"
        | "internal"
    }

type DeleteAdminMessageResult =
  | { ok: true }
  | {
      ok: false
      reason: "unauthenticated" | "forbidden" | "not_found" | "ownership" | "internal"
    }

type MarkThreadReadResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "internal" }

function maxIsoTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a.localeCompare(b) >= 0 ? a : b
}

/**
 * スレッド (= 会員) 一覧。最新メッセージ降順で並べる。
 */
export async function listGritvibAdminThreadsAction(): Promise<ListThreadsResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }
  const { user: adminUser } = adminCheck.session
  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    console.error("[talk/admin] supabase admin client missing (SUPABASE_SERVICE_ROLE_KEY?)")
    return { ok: false, reason: "internal" }
  }

  /** 会員一覧 (RLS bypass で全件) */
  const { data: members, error: membersError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select(
      "id, nickname, subscription_status, subscription_current_period_end, stripe_customer_id, created_at",
    )

  if (membersError) {
    console.error("[talk/admin] fetch members failed", membersError)
    return { ok: false, reason: "internal" }
  }

  const memberRows = members ?? []
  if (memberRows.length === 0) {
    return { ok: true, threads: [] }
  }

  /**
   * 全スレッドのメッセージを時系列昇順で 1 回で取得し、各スレッドごとに
   *   - 最後のメッセージ (preview / 表示用)
   *   - 未読件数 (operator 返信後 & 運営 read_at 後の member メッセージ)
   *   - 未読の最古メッセージ時刻 (ソートキー)
   * を集計する。
   *
   * 件数が多くなった場合のパフォーマンスは将来の課題 (サーバー集約 RPC 化など)。
   */
  const memberIds = memberRows.map((m) => m.id)

  const { data: readRows, error: readError } = await supabaseAdmin
    .from("gritvib_chat_admin_thread_reads")
    .select("thread_member_id, read_at")
    .eq("admin_user_id", adminUser.id)

  if (readError) {
    console.error("[talk/admin] fetch thread reads failed", readError)
    return { ok: false, reason: "internal" }
  }

  const readAtByThread = new Map<string, string>()
  for (const row of readRows ?? []) {
    readAtByThread.set(row.thread_member_id, row.read_at)
  }

  const { data: allMessages, error: messagesError } = await supabaseAdmin
    .from("gritvib_chat_messages")
    .select("thread_member_id, sender_role, body, image_path, created_at")
    .in("thread_member_id", memberIds)
    .order("created_at", { ascending: true })

  if (messagesError) {
    console.error("[talk/admin] fetch messages failed", messagesError)
    return { ok: false, reason: "internal" }
  }

  type ThreadAggregate = {
    last: {
      createdAt: string
      body: string | null
      hasImage: boolean
      senderRole: "member" | "operator"
    } | null
    unreadCount: number
    oldestUnreadAt: string | null
    lastOperatorAt: string | null
  }
  const aggregateByThread = new Map<string, ThreadAggregate>()
  for (const id of memberIds) {
    aggregateByThread.set(id, {
      last: null,
      unreadCount: 0,
      oldestUnreadAt: null,
      lastOperatorAt: null,
    })
  }

  for (const row of (allMessages ?? []) as Array<{
    thread_member_id: string
    sender_role: "member" | "operator"
    body: string | null
    image_path: string | null
    created_at: string
  }>) {
    const entry = aggregateByThread.get(row.thread_member_id)
    if (!entry) continue
    entry.last = {
      createdAt: row.created_at,
      body: row.body,
      hasImage: !!row.image_path,
      senderRole: row.sender_role,
    }
    if (row.sender_role === "operator") {
      entry.lastOperatorAt = row.created_at
      entry.unreadCount = 0
      entry.oldestUnreadAt = null
    } else {
      const readAt = readAtByThread.get(row.thread_member_id) ?? null
      const threshold = maxIsoTimestamp(entry.lastOperatorAt, readAt)
      const countsAsUnread =
        threshold === null ? true : row.created_at > threshold
      if (countsAsUnread) {
        entry.unreadCount += 1
        if (!entry.oldestUnreadAt) entry.oldestUnreadAt = row.created_at
      }
    }
  }

  const threads: GritvibAdminThreadSummary[] = memberRows.map((m) => {
    const agg = aggregateByThread.get(m.id) ?? {
      last: null,
      unreadCount: 0,
      oldestUnreadAt: null,
    }
    return {
      memberId: m.id,
      nickname: m.nickname,
      subscriptionStatus: m.subscription_status,
      subscriptionCurrentPeriodEnd: m.subscription_current_period_end,
      stripeCustomerId: m.stripe_customer_id,
      memberCreatedAt: m.created_at,
      lastMessageAt: agg.last?.createdAt ?? null,
      lastMessageBody: agg.last?.body ?? null,
      lastMessageHasImage: agg.last?.hasImage ?? false,
      lastMessageSenderRole: agg.last?.senderRole ?? null,
      unreadCount: agg.unreadCount,
      oldestUnreadAt: agg.oldestUnreadAt,
    }
  })

  /**
   * ソート方針:
   *   (1) 未読あり → 未読最古が古い順（待たせている順）
   *   (2) 登録済み・メッセージ皆無（未チャット）→ 登録日新しい順
   *   (3) それ以外 → 最新メッセージ降順
   */
  threads.sort((a, b) => {
    const aUnread = a.unreadCount > 0
    const bUnread = b.unreadCount > 0
    if (aUnread !== bUnread) return aUnread ? -1 : 1

    if (aUnread && bUnread) {
      const ao = a.oldestUnreadAt ?? ""
      const bo = b.oldestUnreadAt ?? ""
      return ao.localeCompare(bo)
    }

    const aEmpty = !a.lastMessageAt
    const bEmpty = !b.lastMessageAt
    if (aEmpty !== bEmpty) return aEmpty ? -1 : 1
    if (aEmpty && bEmpty) {
      return b.memberCreatedAt.localeCompare(a.memberCreatedAt)
    }

    const aTs = a.lastMessageAt ?? ""
    const bTs = b.lastMessageAt ?? ""
    return bTs.localeCompare(aTs)
  })

  return { ok: true, threads }
}

/** 運営がスレッドを開いた時刻を保存する（既読）。 */
export async function markGritvibAdminThreadReadAction(
  threadMemberId: string,
): Promise<MarkThreadReadResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }
  const { supabase, user } = adminCheck.session

  const trimmed = threadMemberId.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const { data: memberRow, error: memberError } = await supabase
    .from("gritvib_chat_members")
    .select("id")
    .eq("id", trimmed)
    .maybeSingle()

  if (memberError) {
    console.error("[talk/admin] mark read verify member failed", memberError)
    return { ok: false, reason: "internal" }
  }
  if (!memberRow) return { ok: false, reason: "not_found" }

  const readAt = new Date().toISOString()
  const { error: upsertError } = await supabase.from("gritvib_chat_admin_thread_reads").upsert(
    {
      admin_user_id: user.id,
      thread_member_id: trimmed,
      read_at: readAt,
    },
    { onConflict: "admin_user_id,thread_member_id" },
  )

  if (upsertError) {
    console.error("[talk/admin] mark thread read failed", upsertError)
    return { ok: false, reason: "internal" }
  }

  return { ok: true }
}

export async function fetchGritvibAdminThreadMessagesAction(
  threadMemberId: string,
): Promise<FetchMessagesResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }

  const trimmed = threadMemberId.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    return { ok: false, reason: "internal" }
  }

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("id")
    .eq("id", trimmed)
    .maybeSingle()

  if (memberError) {
    console.error("[talk/admin] verify member failed", memberError)
    return { ok: false, reason: "internal" }
  }
  if (!memberRow) {
    return { ok: false, reason: "not_found" }
  }

  const { data, error } = await supabaseAdmin
    .from("gritvib_chat_messages")
    .select("id, thread_member_id, sender_role, sender_user_id, body, image_path, created_at")
    .eq("thread_member_id", trimmed)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[talk/admin] fetch thread messages failed", error)
    return { ok: false, reason: "internal" }
  }

  const messages: GritvibAdminMessage[] = (data ?? []).map((row) => ({
    id: row.id,
    threadMemberId: row.thread_member_id,
    senderRole: row.sender_role,
    senderUserId: row.sender_user_id,
    body: row.body,
    imagePath: row.image_path,
    createdAt: row.created_at,
  }))

  return { ok: true, messages }
}

export async function sendGritvibAdminMessageAction(input: {
  threadMemberId: string
  body?: string | null
  imagePath?: string | null
}): Promise<SendAdminMessageResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }
  const { supabase, user } = adminCheck.session

  const threadMemberId = input.threadMemberId.trim()
  const trimmedBody = (input.body ?? "").trim()
  const trimmedImagePath = (input.imagePath ?? "").trim()

  if (!threadMemberId) return { ok: false, reason: "not_found" }
  if (trimmedBody.length === 0 && trimmedImagePath.length === 0) {
    return { ok: false, reason: "empty_payload" }
  }
  if (trimmedBody.length > MESSAGE_BODY_MAX_LENGTH) {
    return { ok: false, reason: "body_too_long" }
  }

  /**
   * 画像 path は admin の場合 `{auth.uid()}/...` 形式が望ましいが、必須ではない (admin RLS で許可)。
   * ただし最低限のパス検証として bucket prefix が混入していないか確認する。
   */
  if (trimmedImagePath.length > 0 && trimmedImagePath.startsWith("/")) {
    return { ok: false, reason: "invalid_image_path" }
  }

  const { data: target, error: targetError } = await supabase
    .from("gritvib_chat_members")
    .select("id")
    .eq("id", threadMemberId)
    .maybeSingle()
  if (targetError) {
    console.error("[talk/admin] check target thread failed", targetError)
    return { ok: false, reason: "internal" }
  }
  if (!target) {
    return { ok: false, reason: "not_found" }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("gritvib_chat_messages")
    .insert({
      thread_member_id: threadMemberId,
      sender_role: "operator",
      sender_user_id: user.id,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      image_path: trimmedImagePath.length > 0 ? trimmedImagePath : null,
    })
    .select(
      "id, thread_member_id, sender_role, sender_user_id, body, image_path, created_at",
    )
    .single()

  if (insertError || !inserted) {
    console.error("[talk/admin] insert operator message failed", insertError)
    return { ok: false, reason: "internal" }
  }

  return { ok: true, message: mapGritvibChatMessageRow(inserted) }
}

export async function deleteGritvibAdminMessageAction(
  messageId: string,
): Promise<DeleteAdminMessageResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }
  const { supabase, user } = adminCheck.session

  const trimmed = messageId.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const { data: target, error: targetError } = await supabase
    .from("gritvib_chat_messages")
    .select("id, thread_member_id, sender_user_id, image_path")
    .eq("id", trimmed)
    .maybeSingle()

  if (targetError) {
    console.error("[talk/admin] read message failed", targetError)
    return { ok: false, reason: "internal" }
  }
  if (!target) return { ok: false, reason: "not_found" }
  if (target.sender_user_id !== user.id) {
    /**
     * 仕様: 「自分が送ったメッセージのみ削除可」。
     * admin であっても、会員が送ったメッセージや別 operator のメッセージは触らない。
     * 両側完全削除のため誤操作リスクが高いので、ここはあえて厳しく制限する。
     */
    return { ok: false, reason: "ownership" }
  }

  const { error: deleteError } = await supabase
    .from("gritvib_chat_messages")
    .delete()
    .eq("id", trimmed)

  if (deleteError) {
    console.error("[talk/admin] delete message failed", deleteError)
    return { ok: false, reason: "internal" }
  }

  if (target.image_path) {
    const { error: storageError } = await supabase.storage
      .from("gritvib-chat-photos")
      .remove([target.image_path])
    if (storageError) {
      console.warn("[talk/admin] storage remove failed", storageError)
    }
  }

  return { ok: true }
}
