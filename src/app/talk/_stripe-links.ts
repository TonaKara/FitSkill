/**
 * GritVib (人間チャットサービス) の Stripe 関連 URL。
 *
 * 設計:
 *   - 本番は **Live mode** の Payment Link / Customer Portal を直書きする。
 *   - Payment Link 編集画面の Metadata に `service = gritvib` を必ず仕込むこと
 *     (無いと Webhook が GritVib として認識しない。保険として本番 env に
 *      `STRIPE_GRITVIB_PAYMENT_LINK_ID=plink_...` も設定可)。
 *   - 決済完了後のリダイレクト先は `https://gritvib.com/talk/chat?sub=ok` を推奨。
 *
 * 海外向け (locale=en):
 *   - Stripe Dashboard で $30 USD / 月の Payment Link を別途作成する。
 *   - URL を `subscriptionUsd` または `NEXT_PUBLIC_STRIPE_GRITVIB_PAYMENT_LINK_URL_USD` に設定。
 *   - Webhook 保険用に `STRIPE_GRITVIB_PAYMENT_LINK_ID_USD=plink_...` も設定可。
 *
 * 直書きしているのは既存の `japan-entry/_stripe-links.ts` と同じパターンに揃えるため。
 * 環境変数化したくなった場合は両ファイル同時に揃えること。
 */
export const TALK_STRIPE_LINKS = {
  /**
   * ¥3,000 / 月のサブスクリプション Payment Link (Live, JPY)。
   * plink: `plink_1TeQ2iAMn0h2d5e2jA8OWs0q`
   */
  subscription: "https://buy.stripe.com/28EbJ05V8aqf7MS0Z19IQ08",
  /**
   * $30 / 月のサブスクリプション Payment Link (Live, USD)。
   * plink: `plink_1TfG7yAMn0h2d5e2gE7N15Jr`
   * env 上書き: `NEXT_PUBLIC_STRIPE_GRITVIB_PAYMENT_LINK_URL_USD`
   */
  subscriptionUsd: "https://buy.stripe.com/8x23cu83gbuj2sy9vx9IQ09",
  /** Stripe Customer Portal のログインリンク (Live) */
  customerPortal: "https://billing.stripe.com/p/login/14A4gy3N08i7ebggXZ9IQ00",
} as const

/** Webhook 照合用（metadata `service=gritvib` が無い場合の保険）。env で上書き可。 */
export const TALK_STRIPE_GRITVIB_PAYMENT_LINK_IDS = {
  jpy: "plink_1TeQ2iAMn0h2d5e2jA8OWs0q",
  usd: "plink_1TfG7yAMn0h2d5e2gE7N15Jr",
} as const
