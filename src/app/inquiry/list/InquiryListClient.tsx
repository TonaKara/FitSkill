"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { InquiryInboxList, type InquiryPeerProfile } from "@/components/inquiry/InquiryInboxList"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { fetchInquiryInboxList, type InquiryInboxListRow } from "@/lib/inquiry-messages"
import { normalizeSkillBigIntId, uniqueSkillBigIntIds } from "@/lib/skill-id-bigint"

export function InquiryListClient() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

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
    setThreads(rows)

    const peerIds = [...new Set(rows.map((r) => r.peer_id))]
    const skillIds = uniqueSkillBigIntIds(rows.map((r) => r.last_origin_skill_id))

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

    setLoading(false)
  }, [supabase])

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
      void load()
    }
  }, [userId, load])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-zinc-100">
        <p className="text-center text-sm text-zinc-300">相談一覧を表示するにはログインが必要です。</p>
        <Button
          type="button"
          className="bg-red-600 text-white hover:bg-red-500"
          onClick={() => router.replace(`/login?redirect=${encodeURIComponent("/inquiry/list")}`)}
        >
          ログインへ
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <div className="mx-auto max-w-lg px-4 pb-16 pt-6 md:max-w-2xl md:pt-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white">購入前の相談</h1>
            <p className="mt-1 text-sm text-zinc-400">相手を選ぶとチャットが開きます。</p>
          </div>
          <Button asChild variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500">
            <Link href="/">ホームへ</Link>
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <InquiryInboxList
            threads={threads}
            peerProfiles={peerProfiles}
            skillTitles={skillTitles}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}
