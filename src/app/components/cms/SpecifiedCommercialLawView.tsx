import type { CmsSettingsValues } from "@/lib/cms-settings"

type SpecifiedCommercialLawViewProps = {
  settings: CmsSettingsValues
}

function fallback(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : "未設定"
}

export function SpecifiedCommercialLawView({ settings }: SpecifiedCommercialLawViewProps) {
  return (
    <dl className="space-y-5">
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">販売事業者名</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.site_name)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">所在地</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.address)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">メールアドレス</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.email)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">電話番号</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.phone)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">販売価格</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.price_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">支払方法・支払時期</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.payment_method)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">提供役務の提供時期・引き渡し時期</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.delivery_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">返品について</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.return_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">返金・キャンセルについて</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.refund_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-muted-foreground">その他の販売条件</dt>
        <dd className="mt-1 whitespace-pre-wrap text-foreground">{fallback(settings.service_terms)}</dd>
      </div>
    </dl>
  )
}
