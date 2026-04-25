"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  CMS_SETTINGS_SINGLETON_ID,
  EMPTY_CMS_SETTINGS,
  normalizeCmsSettings,
  type CmsSettingsRow,
  type CmsSettingsValues,
} from "@/lib/cms-settings"
import { SpecifiedCommercialLawView } from "@/components/cms/SpecifiedCommercialLawView"

type CmsSettingsPublicBlockProps = {
  mode: "full" | "footer"
}

export function CmsSettingsPublicBlock({ mode }: CmsSettingsPublicBlockProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CmsSettingsValues>(EMPTY_CMS_SETTINGS)

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
      setSettings(normalizeCmsSettings((data ?? null) as Partial<CmsSettingsRow> | null))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  if (mode === "footer") {
    if (loading) {
      return <p className="text-xs text-zinc-500">特商法情報を読み込み中...</p>
    }
    return (
      <div className="space-y-1 text-xs text-zinc-400">
        <p>運営: {settings.site_name.trim() || "未設定"}</p>
        <p>連絡先: {settings.email.trim() || "未設定"}</p>
        <Link href="/legal/specified-commercial-transactions" className="text-zinc-300 hover:text-white">
          特定商取引法に基づく表記を見る
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 p-8 text-zinc-300">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        情報を読み込み中...
      </div>
    )
  }

  return <SpecifiedCommercialLawView settings={settings} />
}
