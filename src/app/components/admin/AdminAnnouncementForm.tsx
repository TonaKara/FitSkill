"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import type { AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  sendAdminNotification,
  type CreateAnnouncementParams,
  userFacingAnnouncementRpcMessage,
} from "@/lib/transaction-notifications"

const ANNOUNCEMENT_REASON_OPTIONS = [
  "利用規約違反",
  "不適切な画像",
  "重要なお知らせ",
  "運営メンテナンス",
  "運営判断",
] as const

export function AdminAnnouncementForm() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [title, setTitle] = useState("")
  const [reason, setReason] = useState("")
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [adminChecking, setAdminChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  const verifyAdmin = useCallback(async (): Promise<boolean> => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user?.id) {
      setIsAdmin(false)
      return false
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null }>()
    if (profileError || !profile?.is_admin) {
      setIsAdmin(false)
      return false
    }
    setIsAdmin(true)
    return true
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setAdminChecking(true)
      await verifyAdmin()
      if (!cancelled) {
        setAdminChecking(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [verifyAdmin])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const ok = await verifyAdmin()
    if (!ok) {
      setNotice({ variant: "error", message: "この操作には管理者としてのログインが必要です。" })
      return
    }
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle || !trimmedContent || !reason.trim()) {
      setNotice({ variant: "error", message: "タイトル・理由・本文を入力してください。" })
      return
    }

    setSending(true)
    const payloadContent = trimmedContent
    // title / reason / content を分離して send_admin_notification に送る。
    const announcementPayload: CreateAnnouncementParams = {
      title: trimmedTitle,
      reason: reason.trim(),
      content: payloadContent,
      target_user_id: null,
    }
    const { error } = await sendAdminNotification(supabase, announcementPayload)
    setSending(false)
    if (error) {
      console.error("[AdminAnnouncementForm] send_admin_notification failed", {
        message: error.message,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        status: error.status ?? null,
        statusText: error.statusText ?? null,
        title: trimmedTitle,
        target_user_id: null,
      })
      setNotice({
        variant: "error",
        message: userFacingAnnouncementRpcMessage(error),
      })
      return
    }
    setTitle("")
    setReason("")
    setContent("")
    setNotice({ variant: "success", message: "お知らせを作成し、通知を送信しました。" })
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <h2 className="mb-3 text-lg font-bold text-white">お知らせ作成</h2>
      {adminChecking ? (
        <p className="mb-3 text-sm text-zinc-400">管理者権限を確認中...</p>
      ) : !isAdmin ? (
        <p className="mb-3 text-sm text-red-400">管理者権限がないため送信できません。</p>
      ) : null}
      <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">タイトル</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
            placeholder="例: 規約改定のお知らせ"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">理由選択</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
          >
            <option value="">理由を選択</option>
            {ANNOUNCEMENT_REASON_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">本文</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            placeholder="お知らせ本文を入力"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={sending || adminChecking || !isAdmin}
            className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
          >
            {sending ? "送信中..." : "送信ボタン"}
          </Button>
        </div>
      </form>
    </section>
  )
}
