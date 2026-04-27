"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { normalizeProfileCategory } from "@/lib/profile-fields"
import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { getIsAdminFromProfile } from "@/lib/admin"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"

export default function ProfileSetupPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [bio, setBio] = useState("")
  const [fitnessHistory, setFitnessHistory] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )
  }

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user) {
        router.replace("/login")
        return
      }
      setUserId(data.user.id)
      setIsAdmin(await getIsAdminFromProfile(supabase, data.user.id))
      setAuthLoading(false)
    }

    void checkAuth()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return
    }
    setProfileLoading(true)
    /** 存在しないカラムを列挙すると PostgREST がエラーになるため、* で取得してクライアント側で解釈する */
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "プロフィールの読み込みに失敗しました。" }),
      )
      setProfileLoading(false)
      return
    }

    const row = data as Record<string, unknown> | null
    const bioVal = row?.bio
    const fhVal = row?.fitness_history
    setBio(typeof bioVal === "string" ? bioVal.trim() : "")
    setFitnessHistory(typeof fhVal === "string" ? fhVal.trim() : "")
    setSelectedCategories(
      normalizeProfileCategory(row?.category).filter((c) => c !== "フィットネス"),
    )
    setProfileLoading(false)
  }, [supabase, userId, isAdmin])

  useEffect(() => {
    if (userId) {
      void loadProfile()
    }
  }, [userId, loadProfile])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }
    setNotice(null)
    setSaving(true)

    const { error } = await supabase
      .from("profiles")
      .update({
        bio: bio.trim() || null,
        fitness_history: fitnessHistory.trim() || null,
        category: selectedCategories,
      })
      .eq("id", userId)

    setSaving(false)

    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "保存に失敗しました。" }))
      return
    }

    router.push("/")
    router.refresh()
  }

  if (authLoading || (userId && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-16 pt-8 text-zinc-50">
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">プロフィール設定</h1>
            <p className="mt-2 text-sm text-zinc-400">自己紹介や興味のある分野を登録して、FitSkill を始めましょう！</p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-red-400 underline-offset-4 transition-colors hover:text-red-300 hover:underline"
          >
            スキップしてホームへ
          </Link>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <label htmlFor="bio" className="text-sm font-bold text-zinc-200">
              自己紹介
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="自分の得意なことや経歴、克服したいことなど"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <label htmlFor="fitness_history" className="text-sm font-bold text-zinc-200">
              フィットネス歴
            </label>
            <textarea
              id="fitness_history"
              value={fitnessHistory}
              onChange={(e) => setFitnessHistory(e.target.value)}
              rows={4}
              placeholder="例：ジム歴3年、週末はランニングなど"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
            />
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
            <p className="text-sm font-bold text-zinc-200">興味のある分野</p>
            <p className="mt-1 text-xs text-zinc-500">複数選択できます</p>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SKILL_CATEGORY_OPTIONS.map((category) => {
                const id = `cat-${category}`
                const checked = selectedCategories.includes(category)
                return (
                  <li key={category}>
                    <label
                      htmlFor={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked
                          ? "border-red-500/60 bg-red-950/30"
                          : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-600"
                      }`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                        className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 focus:ring-offset-zinc-950"
                      />
                      <span className="text-sm text-zinc-200">{category}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                保存中...
              </>
            ) : (
              "保存する"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
