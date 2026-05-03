import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeSkillBigIntId } from "@/lib/skill-id-bigint"

/** bigint 相当のスキル ID（アプリ内は十進文字列で統一） */
export type SkillBigIntId = string

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

export async function fetchInquiryInboxList(
  supabase: SupabaseClient,
): Promise<{ rows: InquiryInboxListRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("inquiry_inbox_list")
  if (error) {
    return { rows: [], error: error.message }
  }
  const rows = (data ?? [])
    .map((row: unknown) => mapInquiryInboxListRow(row as Record<string, unknown>))
    .filter((row: InquiryInboxListRow | null): row is InquiryInboxListRow => row != null)
  return { rows, error: null }
}

export async function fetchInquiryThreadMessages(
  supabase: SupabaseClient,
  peerId: string,
): Promise<{ rows: InquiryMessageRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("inquiry_thread_messages", { p_peer_id: peerId })
  if (error) {
    return { rows: [], error: error.message }
  }
  const rows = (data ?? [])
    .map((row: unknown) => mapInquiryMessageRow(row as Record<string, unknown>))
    .filter((row: InquiryMessageRow | null): row is InquiryMessageRow => row != null)
  return { rows, error: null }
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
