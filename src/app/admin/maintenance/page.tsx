"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NotificationToast } from "@/components/ui/notification-toast"
import type { AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type SettingsRow = {
  id: string | number | null
  is_maintenance: boolean
  updated_at: string | null
  /** DB から 1 件取得できなかったときの表示用（初期値） */
  isFallback: boolean
}

const FALLBACK_SETTINGS_ROW: SettingsRow = {
  id: null,
  is_maintenance: false,
  updated_at: null,
  isFallback: true,
}

function logSupabaseError(context: string, error: unknown) {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string
      name?: string
      code?: string
      details?: string
      hint?: string
    }
    console.error(`[AdminMaintenance] ${context}`, {
      name: e.name,
      message: e.message,
      code: e.code,
      details: e.details,
      hint: e.hint,
      raw: error,
    })
    return
  }
  console.error(`[AdminMaintenance] ${context}`, error)
}

function normalizeSettingsRecord(data: Record<string, unknown>): SettingsRow {
  return {
    id: (data.id as string | number) ?? null,
    is_maintenance: Boolean(data.is_maintenance),
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
    isFallback: false,
  }
}

export default function AdminMaintenancePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [row, setRow] = useState<SettingsRow | null>(null)
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  const loadSettings = useCallback(async () => {
    setSettingsWarning(null)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user?.id) {
      setAccessDenied(true)
      setRow(null)
      return
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .maybeSingle<{ is_admin: boolean | null }>()

    if (profileError || !profileRow?.is_admin) {
      setAccessDenied(true)
      setRow(null)
      return
    }

    setAccessDenied(false)

    const { data, error } = await supabase.from("settings").select("*").single()

    if (error) {
      logSupabaseError("settings の select('*').single() が失敗しました", error)
      setSettingsWarning(
        "設定行を取得できませんでした。表示は初期値（メンテナンス OFF）です。保存すると新規行が作成される場合があります。",
      )
      setRow({ ...FALLBACK_SETTINGS_ROW })
      return
    }

    if (!data || typeof data !== "object") {
      console.error("[AdminMaintenance] settings の single() は成功したが data が空です", { data })
      setSettingsWarning("設定データが空のため、初期表示に切り替えました。")
      setRow({ ...FALLBACK_SETTINGS_ROW })
      return
    }

    setRow(normalizeSettingsRecord(data as Record<string, unknown>))
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      try {
        await loadSettings()
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [loadSettings])

  const maintenanceOn = Boolean(row?.is_maintenance)

  const handleToggle = async () => {
    if (!row || updating) {
      return
    }
    const confirmed = window.confirm(
      "サイト全体に影響します。メンテナンスモードを切り替えてもよろしいですか？",
    )
    if (!confirmed) {
      return
    }

    const next = !maintenanceOn
    setUpdating(true)
    try {
      if (row.id == null) {
        const { data: inserted, error: insertError } = await supabase
          .from("settings")
          .insert({ is_maintenance: next })
          .select("*")
          .single()

        if (insertError) {
          logSupabaseError("settings の insert().select('*').single() が失敗しました", insertError)
          setNotice({ variant: "error", message: "メンテナンス設定の作成に失敗しました。" })
          return
        }
        if (!inserted || typeof inserted !== "object") {
          console.error("[AdminMaintenance] insert 成功後の data が不正です", { inserted })
          setNotice({ variant: "error", message: "設定の反映に失敗しました。" })
          return
        }
      } else {
        const { data: updated, error: updateError } = await supabase
          .from("settings")
          .update({ is_maintenance: next })
          .eq("id", row.id)
          .select("*")
          .single()

        if (updateError) {
          logSupabaseError("settings の update().select('*').single() が失敗しました", updateError)
          setNotice({ variant: "error", message: "メンテナンス設定の更新に失敗しました。" })
          return
        }
        if (!updated || typeof updated !== "object") {
          console.error("[AdminMaintenance] update 成功後の data が空です", { updated })
          setNotice({ variant: "error", message: "更新結果を取得できませんでした。" })
          return
        }
      }

      setNotice({
        variant: "success",
        message: next
          ? "メンテナンスモードを有効にしました"
          : "メンテナンスモードを無効にしました",
      })

      await loadSettings()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <h1 className="text-3xl font-black tracking-wide text-white">メンテナンス設定</h1>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">メンテナンスモード</CardTitle>
          <CardDescription className="text-zinc-400">
            有効にすると、公開ページのアクセスがメンテナンス画面へ切り替わります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center text-sm text-zinc-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" />
              読み込み中...
            </div>
          ) : accessDenied ? (
            <p className="text-sm text-amber-300">権限がありません</p>
          ) : row ? (
            <>
              {settingsWarning ? (
                <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
                  {settingsWarning}
                </p>
              ) : null}
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-300">現在の状態</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {maintenanceOn ? (
                      <span className="text-red-400">ON（メンテナンス中）</span>
                    ) : (
                      <span className="text-emerald-400">OFF（通常稼働）</span>
                    )}
                  </p>
                  {row.updated_at ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      最終更新:{" "}
                      {new Date(row.updated_at).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <span className="text-xs font-medium text-zinc-500">切り替え</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={maintenanceOn}
                    aria-label={maintenanceOn ? "メンテナンスを無効にする" : "メンテナンスを有効にする"}
                    disabled={updating}
                    onClick={() => void handleToggle()}
                    className={cn(
                      "flex h-10 w-[4.25rem] shrink-0 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50",
                      maintenanceOn ? "bg-red-600" : "bg-zinc-600",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block h-8 w-8 shrink-0 rounded-full bg-white shadow-md transition-[margin] duration-200 ease-out",
                        maintenanceOn ? "ml-auto" : "ml-0",
                      )}
                    />
                  </button>
                  <p className="text-xs text-zinc-500">
                    {updating ? "更新中…" : maintenanceOn ? "クリックで OFF にします" : "クリックで ON にします"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">読み込み結果を表示できませんでした。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
