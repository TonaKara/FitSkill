"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import type { AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type AnnouncementNotificationRow = {
  id: string
  sender_id: string | null
  title: string | null
  reason: string | null
  content: string | null
  created_at: string
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AdminAnnouncementsList() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [rows, setRows] = useState<AnnouncementNotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const loadRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("notifications")
      .select("id, sender_id, title, reason, content, created_at")
      .eq("is_admin_origin", true)
      .eq("type", "announcement")
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) {
      console.error("[AdminAnnouncementsList] notifications fetch failed", error)
      setNotice({ variant: "error", message: "お知らせ一覧の取得に失敗しました。" })
      setRows([])
      setLoading(false)
      return
    }
    setRows((data ?? []) as AnnouncementNotificationRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = window.confirm("このお知らせを削除しますか？")
      if (!ok) {
        return
      }
      setDeletingId(id)
      try {
        // notifications を id 指定で削除。削除結果を受け取って 0 件削除も失敗扱いにする。
        const { data: deletedRows, error } = await supabase
          .from("notifications")
          .delete()
          .eq("id", id)
          .select("id")

        if (error) {
          console.error("[AdminAnnouncementsList] notifications delete failed", {
            table: "notifications",
            id,
            message: error.message,
            code: (error as { code?: string }).code ?? null,
            details: (error as { details?: string }).details ?? null,
            hint: (error as { hint?: string }).hint ?? null,
          })
          setNotice({ variant: "error", message: "お知らせの削除に失敗しました。時間を置いて再度お試しください。" })
          return
        }

        if (!deletedRows || deletedRows.length === 0) {
          console.error("[AdminAnnouncementsList] delete affected zero rows", {
            table: "notifications",
            id,
          })
          setNotice({ variant: "error", message: "削除対象が見つからないか、権限により削除できませんでした。" })
          return
        }

        // 削除成功を確認してから UI を更新。
        setRows((prev) => prev.filter((row) => row.id !== id))
        setOpenIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setNotice({ variant: "success", message: "お知らせを削除しました。" })
        await loadRows()
      } finally {
        setDeletingId(null)
      }
    },
    [loadRows, supabase],
  )

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <h2 className="mb-3 text-lg font-bold text-white">送信済みお知らせ一覧</h2>
      {loading ? (
        <div className="flex items-center text-sm text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" />
          読み込み中...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">送信済みのお知らせはありません。</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => {
            const open = openIds.has(item.id)
            return (
              <li key={item.id} className="overflow-hidden rounded border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.id)) {
                          next.delete(item.id)
                        } else {
                          next.add(item.id)
                        }
                        return next
                      })
                    }
                  >
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.title?.trim() || "タイトルなし"}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDateTime(item.created_at)}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      送信者ID: {item.sender_id?.trim() || "不明"}
                    </p>
                  </button>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-red-700 text-xs text-white hover:bg-red-600 disabled:opacity-60"
                    disabled={deletingId === item.id}
                    onClick={() => void handleDelete(item.id)}
                  >
                    {deletingId === item.id ? "削除中..." : "削除"}
                  </Button>
                </div>
                {open ? (
                  <div className="space-y-2 px-3 py-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">理由</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-300">{item.reason?.trim() || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">本文</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-200">{item.content?.trim() || "（本文なし）"}</p>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

