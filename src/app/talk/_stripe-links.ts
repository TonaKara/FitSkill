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
 * 直書きしているのは既存の `japan-entry/_stripe-links.ts` と同じパターンに揃えるため。
 * 環境変数化したくなった場合は両ファイル同時に揃えること。
 */
export const TALK_STRIPE_LINKS = {
  /** ¥3,000 / 月のサブスクリプション Payment Link (Live) */
  subscription: "https://buy.stripe.com/28EbJ05V8aqf7MS0Z19IQ08",
  /** Stripe Customer Portal のログインリンク (Live) */
  customerPortal: "https://billing.stripe.com/p/login/14A4gy3N08i7ebggXZ9IQ00",
} as const
