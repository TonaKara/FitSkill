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
}

export function CmsSettingsPublicBlock({ mode }: CmsSettingsPublicBlockProps) {
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
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card/50 p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("loadingDetails")}
      </div>
    )
  }

  return <SpecifiedCommercialLawView settings={settings} />
}
