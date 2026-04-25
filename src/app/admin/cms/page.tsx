"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { toSuccessNotice, type AppNotice } from "@/lib/notifications"
import {
  CMS_SETTINGS_FIELDS,
  CMS_SETTINGS_SINGLETON_ID,
  EMPTY_CMS_SETTINGS,
  normalizeCmsSettings,
  type CmsSettingsRow,
  type CmsSettingsValues,
} from "@/lib/cms-settings"
import { SpecifiedCommercialLawView } from "@/components/cms/SpecifiedCommercialLawView"

export default function AdminCmsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [form, setForm] = useState<CmsSettingsValues>(EMPTY_CMS_SETTINGS)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("cms_settings")
        .select(
          "id, site_name, address, email, phone, price_info, payment_method, delivery_info, return_policy, refund_policy, service_terms",
        )
        .eq("id", CMS_SETTINGS_SINGLETON_ID)
        .maybeSingle()

      if (cancelled) {
        return
      }
      setForm(normalizeCmsSettings((data ?? null) as Partial<CmsSettingsRow> | null))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleChange = (key: keyof CmsSettingsValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from("cms_settings").upsert(
      {
        id: CMS_SETTINGS_SINGLETON_ID,
        ...form,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    setSaving(false)

    if (error) {
      setNotice({ variant: "error", message: `保存に失敗しました: ${error.message}` })
      return
    }
    setNotice(toSuccessNotice("CMS設定を保存しました。"))
  }

  return (
    <div className="space-y-6">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <h1 className="text-3xl font-black tracking-wide text-white">CMS設定</h1>
      {loading ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-400" />
          設定を読み込み中...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-bold text-white">編集フォーム</h2>
            {CMS_SETTINGS_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-semibold text-zinc-200" htmlFor={`cms-${field.key}`}>
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    id={`cms-${field.key}`}
                    value={form[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                ) : (
                  <input
                    id={`cms-${field.key}`}
                    type="text"
                    value={form[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存
            </button>
          </section>

          <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-bold text-white">プレビュー（特定商取引法に基づく表記）</h2>
            <SpecifiedCommercialLawView settings={form} />
          </section>
        </div>
      )}
    </div>
  )
}
