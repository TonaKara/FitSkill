import { HeroSection } from "@/landing-preview/_hero-section"
import { WhatWeDoSection } from "@/landing-preview/_what-we-do-section"
import { PricingSection } from "@/landing-preview/_pricing-section"
import { RequestFormSection } from "@/landing-preview/_request-form-section"

/**
 * GritVib フィードバックサービスの叩き台ランディング (仮置きルート)。
 *
 * 構成:
 *   1. Hero          : 文字 2 行 → 流れ 3 ステップ を 1 セクション内で繋ぐシーケンス
 *   2. WhatWeDo      : サービスの全容 (4 カード)
 *   3. Pricing       : ¥500 / 件のシングルプラン
 *   4. RequestForm   : contact_submissions に保存される依頼フォーム
 *
 * `Flow` セクションはヒーローに統合済み。`_flow-section.tsx` は将来別ページや
 * バリエーション向けに残してあるが、現状のページからは未参照。
 *
 * 後で `/` に昇格する想定。現時点は `/landing-preview` で動作確認用。
 */
export default function LandingPreviewPage() {
  return (
    <>
      <HeroSection />
      <WhatWeDoSection />
      <PricingSection />
      <RequestFormSection />
    </>
  )
}
