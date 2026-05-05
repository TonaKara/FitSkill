"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { InquiryInboxList, type InquiryPeerProfile } from "@/components/inquiry/InquiryInboxList"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { fetchInquiryInboxList, type InquiryInboxListRow } from "@/lib/inquiry-messages"
import { normalizeSkillBigIntId, uniqueSkillBigIntIds } from "@/lib/skill-id-bigint"

type MypageInquirySectionProps = {
  userId: string
  mode: "student" | "instructor"
}

export function MypageInquirySection({ userId, mode }: MypageInquirySectionProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
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
      setError(fetchError)
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
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">購入前の相談</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {mode === "instructor"
          ? "あなたの出品に届いた相談を表示しています。"
          : "あなたが送信した相談を表示しています。"}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild className="bg-red-600 font-bold text-white hover:bg-red-500">
          <Link href="/inquiry/list">相談一覧を全画面で開く</Link>
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <InquiryInboxList
          threads={threads}
          peerProfiles={peerProfiles}
          skillTitles={skillTitles}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  )
}
