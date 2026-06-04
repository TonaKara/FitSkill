"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  getGritvibAdminSubscriptionCapacityAction,
  updateGritvibAdminSubscriptionCapacityAction,
} from "@/talk/admin/_capacity-actions"
import {
  gritvibEffectiveCapacityMax,
  type GritvibSubscriptionCapacityStatus,
} from "@/lib/talk/gritvib-subscription-capacity"

/**
 * 管理画面: サブスク新規枠の上限人数（新規「有効にする」ボタンのみに反映）。
 */
export function AdminSubscriptionCapacitySettings() {
  const [activeCount, setActiveCount] = useState(0)
  const [acceptingNew, setAcceptingNew] = useState(true)
  const [displayMax, setDisplayMax] = useState(0)
  const [draftMax, setDraftMax] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const applyLoadedStatus = useCallback((status: GritvibSubscriptionCapacityStatus) => {
    const effective = gritvibEffectiveCapacityMax(status.capacityMax)
    setActiveCount(status.activeCount)
    setAcceptingNew(status.acceptingNew)
    setDisplayMax(effective)
    setDraftMax("")
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const result = await getGritvibAdminSubscriptionCapacityAction()
    if (!result.ok) {
      if (result.reason === "forbidden") {
        setErrorMessage("管理者権限がないため、枠の設定を表示できません。")
      } else if (result.reason === "unauthenticated") {
        setErrorMessage("ログインし直してから、もう一度お試しください。")
      } else {
        setErrorMessage("枠の情報を読み込めませんでした。")
      }
      setLoading(false)
      return
    }
    applyLoadedStatus(result.status)
    setLoading(false)
  }, [applyLoadedStatus])

  useEffect(() => {
    void load()
  }, [load])

  const trimmedDraft = draftMax.trim()
  const canSave = trimmedDraft !== "" && !saving

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    setErrorMessage(null)
    const result = await updateGritvibAdminSubscriptionCapacityAction({
      capacityMax: trimmedDraft,
    })
    setSaving(false)
    if (!result.ok) {
      if (result.reason === "invalid_capacity") {
        setErrorMessage("上限は 0 以上の整数で入力してください。")
      } else if (result.reason === "forbidden") {
        setErrorMessage("管理者権限がないため、保存できません。")
      } else {
        setErrorMessage("保存に失敗しました。時間をおいて再度お試しください。")
      }
      return
    }
    applyLoadedStatus(result.status)
    setErrorMessage(null)
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="hidden border-b border-zinc-200 bg-zinc-50/80 px-3 py-3 md:block md:px-4"
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          読み込み中…
        </p>
      ) : (
        <>
          <div className="space-y-1 text-sm text-black">
            <p>
              有効人数：<span className="font-medium">{activeCount}</span>人
            </p>
            <p>
              <span
                className={
                  acceptingNew ? "text-zinc-700" : "font-medium text-[#e64a19]"
                }
              >
                {acceptingNew ? "受付中" : "停止中"}
              </span>
            </p>
            <p>
              上限：<span className="font-medium">{displayMax}</span>人
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              id="gritvib-capacity-max"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              aria-label="上限人数"
              value={draftMax}
              placeholder={String(displayMax)}
              onChange={(e) => setDraftMax(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-black px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </>
      )}
      {errorMessage ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  )
}
