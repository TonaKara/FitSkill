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
        <dt className="text-sm font-semibold text-zinc-300">販売事業者名</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.site_name)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">所在地</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.address)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">メールアドレス</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.email)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">電話番号</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.phone)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">販売価格</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.price_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">支払方法・支払時期</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.payment_method)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">提供役務の提供時期・引き渡し時期</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.delivery_info)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">返品について</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.return_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">返金・キャンセルについて</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.refund_policy)}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold text-zinc-300">その他の販売条件</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-100">{fallback(settings.service_terms)}</dd>
      </div>
    </dl>
  )
}
