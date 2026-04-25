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
}> {
  const settings = await fetchConsultationSettings(supabase, skillId)
  if (!settings?.is_enabled) {
    return {
      allowed: true,
      requiresConsultation: false,
      answerStatus: null,
    }
  }
  const answer = await fetchMyConsultationAnswer(supabase, skillId, buyerId)
  const status = answer?.status ?? null
  return {
    allowed: status === "accepted",
    requiresConsultation: true,
    answerStatus: status,
  }
}
