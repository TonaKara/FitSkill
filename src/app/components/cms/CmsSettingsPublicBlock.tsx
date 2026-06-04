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
import { useTranslations } from "@/lib/i18n/useI18n"

type CmsSettingsPublicBlockProps = {
  mode: "full" | "footer"
  /**
   * 詳細表示時の見た目を切り替える。`SpecifiedCommercialLawView` の variant を素通しする。
   *   - "default": サイト共通テーマで描画。
   *   - "plain":   GritVib 系の白黒ページ向け。背景・枠なしのプレーン表示。
   */
  variant?: "default" | "plain"
}

export function CmsSettingsPublicBlock({ mode, variant = "default" }: CmsSettingsPublicBlockProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("cmsPublic")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<CmsSettingsValues>(EMPTY_CMS_SETTINGS)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("cms_settings")
        .select(
          "id, site_name, operations_manager, address, email, phone, price_info, payment_method, delivery_info, refund_policy, service_terms",
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
      return <p className="text-xs text-muted-foreground">{t("loadingFooter")}</p>
    }
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("operator", { name: settings.site_name.trim() || t("unset") })}</p>
        <p>{t("contact", { email: settings.email.trim() || t("unset") })}</p>
        <Link href="/legal/specified-commercial-transactions" className="text-foreground/90 hover:text-primary">
          {t("viewLink")}
        </Link>
      </div>
    )
  }

  if (loading) {
    if (variant === "plain") {
      return (
        <div className="flex items-center justify-center p-8 text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("loadingDetails")}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/50 p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("loadingDetails")}
      </div>
    )
  }

  return <SpecifiedCommercialLawView settings={settings} variant={variant} />
}
