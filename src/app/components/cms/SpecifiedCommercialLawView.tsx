"use client"

import type { CmsSettingsValues } from "@/lib/cms-settings"
import { useTranslations } from "@/lib/i18n/useI18n"

type SpecifiedCommercialLawViewProps = {
  settings: CmsSettingsValues
}

export function SpecifiedCommercialLawView({ settings }: SpecifiedCommercialLawViewProps) {
  const t = useTranslations("cmsPublic")
  const tLabels = useTranslations("cmsPublic.labels")

  const fallback = (value: string): string => {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : t("unset")
  }

  return (
    <dl className="space-y-5">
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("siteName")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.site_name)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("address")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.address)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("email")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.email)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("phone")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.phone)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("priceInfo")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.price_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("paymentMethod")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.payment_method)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("deliveryInfo")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.delivery_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("returnPolicy")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.return_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("refundPolicy")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.refund_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">{tLabels("serviceTerms")}</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.service_terms)}</dd>
      </div>
    </dl>
  )
}
