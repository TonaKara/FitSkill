"use server"

import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireGritvibAdminUser } from "@/lib/talk/admin-auth"
import {
  GRITVIB_INQUIRY_SOURCE,
  GRITVIB_INQUIRY_SUBJECT_LEGACY,
  GRITVIB_INQUIRY_STATUSES,
  type GritvibInquiryStatus,
} from "@/lib/talk/inquiry-constants"

const ATTACHMENT_BUCKET = "contact-attachments"
const ATTACHMENT_SIGNED_TTL_SEC = 3600

export type GritvibInquirySummary = {
  id: number
  name: string
  email: string
  category: string
  subject: string
  status: string
  createdAt: string
  hasAttachment: boolean
  submitterProfileId: string | null
}

export type GritvibInquiryDetail = GritvibInquirySummary & {
  content: string
  transactionId: string | null
  attachmentPath: string | null
}

type ListResult =
  | { ok: true; inquiries: GritvibInquirySummary[]; pendingCount: number }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "internal" }

type DetailResult =
  | { ok: true; inquiry: GritvibInquiryDetail }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "internal" }

type UpdateStatusResult =
  | { ok: true }
  | {
      ok: false
      reason: "unauthenticated" | "forbidden" | "not_found" | "invalid_status" | "internal"
    }

type AttachmentUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "internal" }

function rowToSummary(row: Record<string, unknown>): GritvibInquirySummary {
  const attachmentPath = row.attachment_path
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    category: String(row.category ?? ""),
    subject: String(row.subject ?? ""),
    status: String(row.status ?? "pending"),
    createdAt: String(row.created_at ?? ""),
    hasAttachment:
      typeof attachmentPath === "string" && attachmentPath.trim().length > 0,
    submitterProfileId:
      typeof row.submitter_profile_id === "string" ? row.submitter_profile_id : null,
  }
}

export async function listGritvibInquiriesAction(input?: {
  status?: "all" | GritvibInquiryStatus
}): Promise<ListResult> {
  const auth = await requireGritvibAdminUser()
  if (!auth.ok) {
    return { ok: false, reason: auth.reason === "internal" ? "internal" : auth.reason }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return { ok: false, reason: "internal" }
  }

  const statusFilter = input?.status ?? "all"

  /**
   * source 列導入前の行は subject で識別。マイグレーション後は source=gritvib が主。
   */
  let query = admin
    .from("contact_submissions")
    .select(
      "id, name, email, category, subject, status, created_at, attachment_path, submitter_profile_id, source",
    )
    .or(`source.eq.${GRITVIB_INQUIRY_SOURCE},subject.eq.${GRITVIB_INQUIRY_SUBJECT_LEGACY}`)
    .order("created_at", { ascending: false })
    .limit(200)

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }

  const { data, error } = await query
  if (error) {
    console.error("[talk/admin/inquiries] list failed", error)
    return { ok: false, reason: "internal" }
  }

  const inquiries = (data ?? []).map((row) => rowToSummary(row as Record<string, unknown>))

  const { count, error: countError } = await admin
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .or(`source.eq.${GRITVIB_INQUIRY_SOURCE},subject.eq.${GRITVIB_INQUIRY_SUBJECT_LEGACY}`)
    .eq("status", "pending")

  if (countError) {
    console.error("[talk/admin/inquiries] pending count failed", countError)
  }

  return {
    ok: true,
    inquiries,
    pendingCount: count ?? inquiries.filter((i) => i.status === "pending").length,
  }
}

export async function fetchGritvibInquiryDetailAction(
  inquiryId: number,
): Promise<DetailResult> {
  const auth = await requireGritvibAdminUser()
  if (!auth.ok) {
    return { ok: false, reason: auth.reason === "internal" ? "internal" : auth.reason }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return { ok: false, reason: "internal" }
  }

  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    return { ok: false, reason: "not_found" }
  }

  const { data, error } = await admin
    .from("contact_submissions")
    .select(
      "id, name, email, category, subject, status, created_at, content, transaction_id, attachment_path, submitter_profile_id",
    )
    .or(`source.eq.${GRITVIB_INQUIRY_SOURCE},subject.eq.${GRITVIB_INQUIRY_SUBJECT_LEGACY}`)
    .eq("id", inquiryId)
    .maybeSingle()

  if (error) {
    console.error("[talk/admin/inquiries] detail failed", error)
    return { ok: false, reason: "internal" }
  }
  if (!data) {
    return { ok: false, reason: "not_found" }
  }

  const summary = rowToSummary(data as Record<string, unknown>)
  return {
    ok: true,
    inquiry: {
      ...summary,
      content: String(data.content ?? ""),
      transactionId:
        typeof data.transaction_id === "string" ? data.transaction_id : null,
      attachmentPath:
        typeof data.attachment_path === "string" ? data.attachment_path : null,
    },
  }
}

export async function updateGritvibInquiryStatusAction(input: {
  inquiryId: number
  status: GritvibInquiryStatus
}): Promise<UpdateStatusResult> {
  const auth = await requireGritvibAdminUser()
  if (!auth.ok) {
    return { ok: false, reason: auth.reason === "internal" ? "internal" : auth.reason }
  }

  if (!GRITVIB_INQUIRY_STATUSES.includes(input.status)) {
    return { ok: false, reason: "invalid_status" }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return { ok: false, reason: "internal" }
  }

  const inquiryId = input.inquiryId
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    return { ok: false, reason: "not_found" }
  }

  const { data, error } = await admin
    .from("contact_submissions")
    .update({ status: input.status })
    .or(`source.eq.${GRITVIB_INQUIRY_SOURCE},subject.eq.${GRITVIB_INQUIRY_SUBJECT_LEGACY}`)
    .eq("id", inquiryId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[talk/admin/inquiries] status update failed", error)
    return { ok: false, reason: "internal" }
  }
  if (!data) {
    return { ok: false, reason: "not_found" }
  }

  return { ok: true }
}

export async function getGritvibInquiryAttachmentUrlAction(
  inquiryId: number,
): Promise<AttachmentUrlResult> {
  const auth = await requireGritvibAdminUser()
  if (!auth.ok) {
    return { ok: false, reason: auth.reason === "internal" ? "internal" : auth.reason }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return { ok: false, reason: "internal" }
  }

  if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
    return { ok: false, reason: "not_found" }
  }

  const { data, error } = await admin
    .from("contact_submissions")
    .select("attachment_path")
    .or(`source.eq.${GRITVIB_INQUIRY_SOURCE},subject.eq.${GRITVIB_INQUIRY_SUBJECT_LEGACY}`)
    .eq("id", inquiryId)
    .maybeSingle()

  if (error) {
    console.error("[talk/admin/inquiries] attachment path failed", error)
    return { ok: false, reason: "internal" }
  }

  const path =
    typeof data?.attachment_path === "string" ? data.attachment_path.trim() : ""
  if (!path) {
    return { ok: false, reason: "not_found" }
  }

  const { data: signed, error: signError } = await admin.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, ATTACHMENT_SIGNED_TTL_SEC)

  if (signError || !signed?.signedUrl) {
    console.error("[talk/admin/inquiries] signed url failed", signError)
    return { ok: false, reason: "internal" }
  }

  return { ok: true, url: signed.signedUrl }
}
