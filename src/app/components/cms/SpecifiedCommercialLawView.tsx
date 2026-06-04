"use client"

import type { CmsSettingsValues } from "@/lib/cms-settings"
import { useTranslations } from "@/lib/i18n/useI18n"

type SpecifiedCommercialLawViewProps = {
  settings: CmsSettingsValues
  /**
   * 表示モード。
   *   - "default": サイト共通テーマ (`text-foreground` / `text-muted-foreground`) を利用。
   *   - "plain":   GritVib 系の白黒ページ専用。テーマ非依存のグレースケールでレンダリング。
   */
  variant?: "default" | "plain"
}

export function SpecifiedCommercialLawView({
  settings,
  variant = "default",
}: SpecifiedCommercialLawViewProps) {
  const t = useTranslations("cmsPublic")
  const tLabels = useTranslations("cmsPublic.labels")

  const fallback = (value: string): string => {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : t("unset")
  }

  const isPlain = variant === "plain"
  const dtClass = isPlain
    ? "text-sm font-semibold text-zinc-600"
    : "text-sm font-semibold text-muted-foreground"
  const ddClass = isPlain
    ? "mt-1 whitespace-pre-wrap text-black"
    : "mt-1 whitespace-pre-wrap text-foreground"

  return (
    <dl className="space-y-5">
      <div>
        <dt className={dtClass}>{tLabels("siteName")}</dt>
        <dd className={ddClass}>{fallback(settings.site_name)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("operationsManager")}</dt>
        <dd className={ddClass}>{fallback(settings.operations_manager)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("address")}</dt>
        <dd className={ddClass}>{fallback(settings.address)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("email")}</dt>
        <dd className={ddClass}>{fallback(settings.email)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("phone")}</dt>
        <dd className={ddClass}>{fallback(settings.phone)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("priceInfo")}</dt>
        <dd className={ddClass}>{fallback(settings.price_info)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("paymentMethod")}</dt>
        <dd className={ddClass}>{fallback(settings.payment_method)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("deliveryInfo")}</dt>
        <dd className={ddClass}>{fallback(settings.delivery_info)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("refundPolicy")}</dt>
        <dd className={ddClass}>{fallback(settings.refund_policy)}</dd>
      </div>
      <div>
        <dt className={dtClass}>{tLabels("serviceTerms")}</dt>
        <dd className={ddClass}>{fallback(settings.service_terms)}</dd>
      </div>
    </dl>
  )
}
