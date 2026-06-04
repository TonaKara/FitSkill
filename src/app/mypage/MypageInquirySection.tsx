"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { InquiryInboxList, type InquiryPeerProfile } from "@/components/inquiry/InquiryInboxList"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { fetchInquiryInboxList, type InquiryInboxListRow } from "@/lib/inquiry-messages"
import { TRADES_HUB_PANEL_CARD, TRADES_HUB_PANEL_OUTER } from "@/lib/mypage-trades"
import { normalizeSkillBigIntId, uniqueSkillBigIntIds } from "@/lib/skill-id-bigint"
import { useTranslations } from "@/lib/i18n/useI18n"

type MypageInquirySectionProps = {
  userId: string
  mode: "student" | "instructor"
}

export function MypageInquirySection({ userId, mode }: MypageInquirySectionProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const tMy = useTranslations("mypage")
  const tInquiry = useTranslations("inquiry")
  const [threads, setThreads] = useState<InquiryInboxListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [peerProfiles, setPeerProfiles] = useState<Record<string, InquiryPeerProfile>>({})
  const [skillTitles, setSkillTitles] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { rows, error: fetchError } = await fetchInquiryInboxList(supabase)
    if (fetchError) {
      setThreads([])
      setError(tInquiry("inboxLoadFailed"))
      setLoading(false)
      return
    }
    const skillIds = uniqueSkillBigIntIds(rows.map((r) => r.last_origin_skill_id))
    const ownerBySkillId: Record<string, string> = {}
    const nextTitles: Record<string, string> = {}

    if (skillIds.length > 0) {
      const { data: skillData } = await supabase.from("skills").select("id, title, user_id").in("id", skillIds)
      for (const row of skillData ?? []) {
        const rec = row as { id: unknown; title: unknown; user_id: unknown }
        const sid = normalizeSkillBigIntId(rec.id)
        if (sid != null) {
          nextTitles[sid] = String(rec.title ?? "")
          ownerBySkillId[sid] = String(rec.user_id ?? "")
        }
      }
    }

    const filteredRows = rows.filter((r) => {
      const ownerId = ownerBySkillId[r.last_origin_skill_id]
      if (!ownerId) {
        return true
      }
      if (mode === "instructor") {
        return ownerId === userId
      }
      return ownerId !== userId
    })
    setThreads(filteredRows)
    setSkillTitles(nextTitles)

    const peerIds = [...new Set(filteredRows.map((r) => r.peer_id))]
    if (peerIds.length > 0) {
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", peerIds)
      const nextProf: Record<string, InquiryPeerProfile> = {}
      for (const row of (profData ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]) {
        nextProf[row.id] = { display_name: row.display_name, avatar_url: row.avatar_url }
      }
      setPeerProfiles(nextProf)
    } else {
      setPeerProfiles({})
    }

    setLoading(false)
  }, [mode, supabase, userId])

  useEffect(() => {
    if (userId) {
      void load()
    }
  }, [userId, load])

  return (
    <div className={TRADES_HUB_PANEL_OUTER}>
      <div className={TRADES_HUB_PANEL_CARD}>
        <InquiryInboxList
          threads={threads}
          peerProfiles={peerProfiles}
          skillTitles={skillTitles}
          loading={loading}
          error={error}
          emptyHint={mode === "instructor" ? tMy("inquiryEmptyInstructor") : tMy("inquiryEmptyStudent")}
        />
      </div>
    </div>
  )
}
