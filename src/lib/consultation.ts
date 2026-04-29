import type { SupabaseClient } from "@supabase/supabase-js"

export type ConsultationAnswerStatus = "pending" | "accepted" | "rejected"

export type ConsultationSettingsRow = {
  skill_id: number
  q1_label: string | null
  q2_label: string | null
  q3_label: string | null
  free_label: string | null
  is_enabled: boolean
}

export type ConsultationSettingsFetchResult = {
  settings: ConsultationSettingsRow | null
  error: string | null
}

export type ConsultationAnswerRow = {
  id: string
  skill_id: number
  buyer_id: string
  seller_id: string
  a1_text: string | null
  a2_text: string | null
  a3_text: string | null
  free_text: string | null
  status: ConsultationAnswerStatus
}

export function toConsultationSkillId(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) {
    return null
  }
  return Math.trunc(n)
}

export async function fetchConsultationSettings(
  supabase: SupabaseClient,
  skillId: string | number,
): Promise<ConsultationSettingsRow | null> {
  const n = toConsultationSkillId(skillId)
  if (n == null) {
    return null
  }
  const { data, error } = await supabase
    .from("consultation_settings")
    .select("skill_id, q1_label, q2_label, q3_label, free_label, is_enabled")
    .eq("skill_id", n)
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return data as ConsultationSettingsRow
}

export async function fetchConsultationSettingsWithStatus(
  supabase: SupabaseClient,
  skillId: string | number,
): Promise<ConsultationSettingsFetchResult> {
  const n = toConsultationSkillId(skillId)
  if (n == null) {
    return { settings: null, error: "invalid_skill_id" }
  }
  const { data, error } = await supabase
    .from("consultation_settings")
    .select("skill_id, q1_label, q2_label, q3_label, free_label, is_enabled")
    .eq("skill_id", n)
    .maybeSingle()
  if (error) {
    return { settings: null, error: error.message }
  }
  if (!data) {
    return { settings: null, error: null }
  }
  return { settings: data as ConsultationSettingsRow, error: null }
}

export async function fetchMyConsultationAnswer(
  supabase: SupabaseClient,
  skillId: string | number,
  buyerId: string,
): Promise<ConsultationAnswerRow | null> {
  const n = toConsultationSkillId(skillId)
  if (n == null || !buyerId) {
    return null
  }
  const { data, error } = await supabase
    .from("consultation_answers")
    .select("id, skill_id, buyer_id, seller_id, a1_text, a2_text, a3_text, free_text, status")
    .eq("skill_id", n)
    .eq("buyer_id", buyerId)
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return null
  }
  const rows = data as ConsultationAnswerRow[]
  // 重複行が存在しても「承認待ち」を最優先で返し、再送を防ぐ。
  const pending = rows.find((row) => row.status === "pending")
  if (pending) {
    return pending
  }
  const accepted = rows.find((row) => row.status === "accepted")
  if (accepted) {
    return accepted
  }
  return rows[0] ?? null
}

export async function canBuyerPurchaseSkill(
  supabase: SupabaseClient,
  skillId: string | number,
  buyerId: string,
): Promise<{
  allowed: boolean
  requiresConsultation: boolean
  answerStatus: ConsultationAnswerStatus | null
  error: string | null
}> {
  const n = toConsultationSkillId(skillId)
  if (n == null || !buyerId) {
    return {
      allowed: false,
      requiresConsultation: true,
      answerStatus: null,
      error: "invalid_skill_or_buyer",
    }
  }

  const { data: settings, error: settingsError } = await supabase
    .from("consultation_settings")
    .select("is_enabled")
    .eq("skill_id", n)
    .maybeSingle()
  if (settingsError) {
    return {
      allowed: false,
      requiresConsultation: true,
      answerStatus: null,
      error: settingsError.message,
    }
  }

  const requiresConsultation = (settings as { is_enabled?: boolean | null } | null)?.is_enabled === true
  if (!requiresConsultation) {
    return {
      allowed: true,
      requiresConsultation: false,
      answerStatus: null,
      error: null,
    }
  }

  const { data: answers, error: answersError } = await supabase
    .from("consultation_answers")
    .select("status")
    .eq("skill_id", n)
    .eq("buyer_id", buyerId)
  if (answersError) {
    return {
      allowed: false,
      requiresConsultation: true,
      answerStatus: null,
      error: answersError.message,
    }
  }

  const rows = Array.isArray(answers) ? (answers as { status?: ConsultationAnswerStatus | null }[]) : []
  const statuses = rows.map((row) => row.status).filter(Boolean) as ConsultationAnswerStatus[]
  const status: ConsultationAnswerStatus | null = statuses.includes("pending")
    ? "pending"
    : statuses.includes("accepted")
      ? "accepted"
      : statuses.includes("rejected")
        ? "rejected"
        : null

  return {
    allowed: status === "accepted",
    requiresConsultation,
    answerStatus: status,
    error: null,
  }
}
