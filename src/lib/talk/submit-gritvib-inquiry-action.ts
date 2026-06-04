"use server"

import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireActionUser } from "@/lib/supabase/action-auth"
import {
  GRITVIB_INQUIRY_CATEGORY,
  GRITVIB_INQUIRY_SOURCE,
  GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH,
} from "@/lib/talk/inquiry-constants"
import { notifyGritvibInquiryDiscord } from "@/lib/talk/notify-inquiry-discord"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

const CONTENT_MAX_LENGTH = 2000

export type SubmitGritvibInquiryResult =
  | { ok: true }
  | {
      ok: false
      reason: "empty" | "invalid_email" | "subject_too_long" | "content_too_long" | "internal"
    }

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * GritVib 公開お問い合わせフォーム用。DB 保存後に Discord へ通知する。
 */
export async function submitGritvibInquiryAction(input: {
  name: string
  email: string
  subject: string
  content: string
}): Promise<SubmitGritvibInquiryResult> {
  const name = input.name.trim()
  const email = input.email.trim()
  const subject = input.subject.trim()
  const content = input.content.trim()

  if (!name || !email || !subject || !content) {
    return { ok: false, reason: "empty" }
  }
  if (!isValidEmail(email)) {
    return { ok: false, reason: "invalid_email" }
  }
  if (subject.length > GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH) {
    return { ok: false, reason: "subject_too_long" }
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return { ok: false, reason: "content_too_long" }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    logTalkServerError("[talk/inquiry] service role client unavailable")
    return { ok: false, reason: "internal" }
  }

  let submitterProfileId: string | null = null
  const sessionResult = await requireActionUser()
  if (sessionResult.ok) {
    submitterProfileId = sessionResult.session.user.id
  }

  const { data: inserted, error: insertError } = await admin
    .from("contact_submissions")
    .insert({
      name,
      email,
      category: GRITVIB_INQUIRY_CATEGORY,
      subject,
      content,
      transaction_id: null,
      attachment_path: null,
      status: "pending",
      source: GRITVIB_INQUIRY_SOURCE,
      submitter_profile_id: submitterProfileId,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    logTalkServerError("[talk/inquiry] insert failed", insertError)
    return { ok: false, reason: "internal" }
  }

  try {
    await notifyGritvibInquiryDiscord({
      name,
      email,
      category: GRITVIB_INQUIRY_CATEGORY,
      subject,
      submitterProfileId,
      inquiryId: typeof inserted.id === "number" ? inserted.id : null,
    })
  } catch (err) {
    logTalkServerError("[talk/inquiry] discord notify failed", err)
  }

  return { ok: true }
}
