import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeSkillBigIntId } from "@/lib/skill-id-bigint"

/** bigint 相当のスキル ID（アプリ内は十進文字列で統一） */
export type SkillBigIntId = string
const INQUIRY_NOTIFICATION_TYPE = "inquiry_message"

export type InquiryMessageRow = {
  id: string
  sender_id: string
  recipient_id: string
  origin_skill_id: SkillBigIntId
  content: string
  is_read: boolean
  created_at: string
}

export type InquiryInboxListRow = {
  peer_id: string
  last_created_at: string
  last_content: string
  last_origin_skill_id: SkillBigIntId
  last_is_read: boolean
  last_sender_id: string
  last_recipient_id: string
}

function mapInquiryInboxListRow(raw: Record<string, unknown>): InquiryInboxListRow | null {
  const lastOrigin = normalizeSkillBigIntId(raw.last_origin_skill_id)
  if (lastOrigin == null) {
    return null
  }
  return {
    peer_id: String(raw.peer_id ?? ""),
    last_created_at: String(raw.last_created_at ?? ""),
    last_content: String(raw.last_content ?? ""),
    last_origin_skill_id: lastOrigin,
    last_is_read: Boolean(raw.last_is_read),
    last_sender_id: String(raw.last_sender_id ?? ""),
    last_recipient_id: String(raw.last_recipient_id ?? ""),
  }
}

function mapInquiryMessageRow(raw: Record<string, unknown>): InquiryMessageRow | null {
  const origin = normalizeSkillBigIntId(raw.origin_skill_id)
  if (origin == null) {
    return null
  }
  return {
    id: String(raw.id ?? ""),
    sender_id: String(raw.sender_id ?? ""),
    recipient_id: String(raw.recipient_id ?? ""),
    origin_skill_id: origin,
    content: String(raw.content ?? ""),
    is_read: Boolean(raw.is_read),
    created_at: String(raw.created_at ?? ""),
  }
}

/** PostgREST: 関数が schema cache に無い等 */
function isMissingPostgrestRpc(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return m.includes("could not find the function") || m.includes("schema cache")
}

/**
 * RPC 無しで相手ごとの最新 1 件を組み立てる（sender_id / recipient_id スキーマ向け）
 */
async function fetchInquiryInboxListFromMessagesTable(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ rows: InquiryInboxListRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("inquiry_messages")
    .select("sender_id, recipient_id, content, created_at, origin_skill_id, is_read")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) {
    return { rows: [], error: error.message }
  }

  const byPeer = new Map<string, InquiryInboxListRow>()
  for (const raw of data ?? []) {
    const rec = raw as Record<string, unknown>
    const senderId = String(rec.sender_id ?? "")
    const recipientId = String(rec.recipient_id ?? "")
    const peerId = senderId === userId ? recipientId : senderId
    if (!peerId) {
      continue
    }
    if (byPeer.has(peerId)) {
      continue
    }
    const origin = normalizeSkillBigIntId(rec.origin_skill_id)
    if (origin == null) {
      continue
    }
    byPeer.set(peerId, {
      peer_id: peerId,
      last_created_at: String(rec.created_at ?? ""),
      last_content: String(rec.content ?? ""),
      last_origin_skill_id: origin,
      last_is_read: Boolean(rec.is_read),
      last_sender_id: senderId,
      last_recipient_id: recipientId,
    })
  }

  return { rows: Array.from(byPeer.values()), error: null }
}

export async function fetchInquiryInboxList(
  supabase: SupabaseClient,
): Promise<{ rows: InquiryInboxListRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("inquiry_inbox_list")
  if (!error) {
    const rows = (data ?? [])
      .map((row: unknown) => mapInquiryInboxListRow(row as Record<string, unknown>))
      .filter((row: InquiryInboxListRow | null): row is InquiryInboxListRow => row != null)
    return { rows, error: null }
  }

  if (!isMissingPostgrestRpc(error)) {
    return { rows: [], error: error.message }
  }

  const { data: session } = await supabase.auth.getUser()
  const uid = session.user?.id
  if (uid) {
    const fromTable = await fetchInquiryInboxListFromMessagesTable(supabase, uid)
    if (!fromTable.error) {
      return fromTable
    }
    const te = fromTable.error.toLowerCase()
    const looksLikeOldTable =
      te.includes("column") || te.includes("does not exist") || te.includes("42703")
    if (!looksLikeOldTable) {
      return { rows: [], error: `${error.message}（代替: ${fromTable.error}）` }
    }
  }

  const { data: legacyData, error: legacyError } = await supabase.rpc("inquiry_inbox_threads")
  if (legacyError) {
    return { rows: [], error: legacyError.message }
  }

  const legacyRows: Array<InquiryInboxListRow | null> = (legacyData ?? []).map((raw: unknown) => {
    const row = raw as Record<string, unknown>
    const lastOrigin = normalizeSkillBigIntId(row.last_origin_skill_id)
    if (lastOrigin == null) {
      return null
    }
    return {
      peer_id: String(row.peer_id ?? ""),
      last_created_at: String(row.last_created_at ?? ""),
      last_content: String(row.last_content ?? ""),
      last_origin_skill_id: lastOrigin,
      last_is_read: true,
      last_sender_id: "",
      last_recipient_id: "",
    } satisfies InquiryInboxListRow
  })

  return {
    rows: legacyRows.filter((row: InquiryInboxListRow | null): row is InquiryInboxListRow => row != null),
    error: null,
  }
}

export async function fetchInquiryThreadMessages(
  supabase: SupabaseClient,
  peerId: string,
): Promise<{ rows: InquiryMessageRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("inquiry_thread_messages", { p_peer_id: peerId })
  if (!error) {
    const rows = (data ?? [])
      .map((row: unknown) => mapInquiryMessageRow(row as Record<string, unknown>))
      .filter((row: InquiryMessageRow | null): row is InquiryMessageRow => row != null)
    return { rows, error: null }
  }

  if (!isMissingPostgrestRpc(error)) {
    return { rows: [], error: error.message }
  }

  const { data: session } = await supabase.auth.getUser()
  const uid = session.user?.id
  if (!uid) {
    return { rows: [], error: error.message }
  }

  // 現行スキーマ（sender_id / recipient_id）向けフォールバック
  const { data: tableData, error: tableError } = await supabase
    .from("inquiry_messages")
    .select("id, sender_id, recipient_id, origin_skill_id, content, is_read, created_at")
    .or(
      `and(sender_id.eq.${uid},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${uid})`,
    )
    .order("created_at", { ascending: true })

  if (!tableError) {
    const rows = (tableData ?? [])
      .map((row: unknown) => mapInquiryMessageRow(row as Record<string, unknown>))
      .filter((row: InquiryMessageRow | null): row is InquiryMessageRow => row != null)
    return { rows, error: null }
  }

  const tableErr = tableError.message.toLowerCase()
  const looksLikeOldTable =
    tableErr.includes("column") || tableErr.includes("does not exist") || tableErr.includes("42703")
  if (!looksLikeOldTable) {
    return { rows: [], error: `${error.message}（代替: ${tableError.message}）` }
  }

  // 旧スキーマ（buyer_id / seller_id）向けフォールバック
  const { data: legacyData, error: legacyError } = await supabase
    .from("inquiry_messages")
    .select("id, buyer_id, seller_id, sender_id, origin_skill_id, content, created_at")
    .or(
      `and(buyer_id.eq.${uid},seller_id.eq.${peerId}),and(buyer_id.eq.${peerId},seller_id.eq.${uid})`,
    )
    .order("created_at", { ascending: true })

  if (legacyError) {
    return { rows: [], error: `${error.message}（代替: ${legacyError.message}）` }
  }

  const legacyRows: InquiryMessageRow[] = []
  for (const raw of legacyData ?? []) {
    const rec = raw as Record<string, unknown>
    const origin = normalizeSkillBigIntId(rec.origin_skill_id)
    const senderId = String(rec.sender_id ?? "")
    const buyerId = String(rec.buyer_id ?? "")
    const sellerId = String(rec.seller_id ?? "")
    if (origin == null || !senderId || !buyerId || !sellerId) {
      continue
    }
    const recipientId = senderId === buyerId ? sellerId : buyerId
    legacyRows.push({
      id: String(rec.id ?? ""),
      sender_id: senderId,
      recipient_id: recipientId,
      origin_skill_id: origin,
      content: String(rec.content ?? ""),
      is_read: true,
      created_at: String(rec.created_at ?? ""),
    })
  }

  return { rows: legacyRows, error: null }
}

export async function insertInquiryMessage(
  supabase: SupabaseClient,
  payload: {
    sender_id: string
    recipient_id: string
    origin_skill_id: unknown
    content: string
  },
): Promise<{ row: InquiryMessageRow | null; error: string | null }> {
  const origin = normalizeSkillBigIntId(payload.origin_skill_id)
  if (origin == null) {
    return { row: null, error: "origin_skill_id が不正です。" }
  }

  const { data, error } = await supabase
    .from("inquiry_messages")
    .insert({
      sender_id: payload.sender_id,
      recipient_id: payload.recipient_id,
      origin_skill_id: origin,
      content: payload.content.trim(),
      is_read: false,
    })
    .select("id, sender_id, recipient_id, origin_skill_id, content, is_read, created_at")
    .single()

  if (error || !data) {
    return { row: null, error: error?.message ?? "insert failed" }
  }
  const row = mapInquiryMessageRow(data as Record<string, unknown>)
  if (!row) {
    return { row: null, error: "返却行の整形に失敗しました。" }
  }

  // チャット受信者向けの in-app 通知を追加（失敗しても送信自体は成功扱い）
  const { error: notifError } = await supabase.from("notifications").insert({
    recipient_id: payload.recipient_id,
    sender_id: payload.sender_id,
    type: INQUIRY_NOTIFICATION_TYPE,
    title: "新しい相談メッセージ",
    reason: `inquiry:${row.id}`,
    content: "相談チャットに新しいメッセージが届きました。",
    is_admin_origin: false,
    is_read: false,
  })
  if (notifError) {
    console.warn("[inquiry] notifications insert failed:", notifError.message)
  }
  return { row, error: null }
}

/** 相手から自分宛の未読をすべて既読にする */
export async function markInquiryThreadRead(
  supabase: SupabaseClient,
  viewerId: string,
  peerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("inquiry_messages")
    .update({ is_read: true })
    .eq("recipient_id", viewerId)
    .eq("sender_id", peerId)
    .eq("is_read", false)

  return { error: error?.message ?? null }
}
