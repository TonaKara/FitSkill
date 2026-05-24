/**
 * Japan Entry Support 関連の Stripe Payment Link / Customer Portal URL のプレースホルダー。
 *
 * - 本番運用時は Stripe ダッシュボードで作成した URL に差し替えてください。
 * - Payment Link は Checkout 完了後の "Confirmation page" を Custom URL に設定し、
 *   `/japan-entry/thank-you` へ遷移させてください。
 *
 *   例:
 *     1. Stripe ダッシュボード → Payment Links → 該当の Payment Link を編集
 *     2. After payment → "Don't show confirmation page" のチェックを外し
 *        "Show a confirmation page hosted on your website" を選択
 *     3. URL: https://gritvib.com/japan-entry/thank-you
 *
 * - Customer Portal は Stripe ダッシュボードで「Customer portal」を有効化し、
 *   ログインリンク (`https://billing.stripe.com/p/login/xxxxx`) を `customerPortal` に設定。
 */
export const STRIPE_LINKS = {
  /** A La Carte: $30 / post の Payment Link */
  alaCartePost: "https://buy.stripe.com/14A4gy3N08i7ebggXZ9IQ00",
  /** A La Carte: $399 Legal & Compliance Pack の Payment Link */
  alaCarteLegal: "https://buy.stripe.com/00wbJ02IWdCr3wCazB9IQ02",
  /** Standard $499 / month の Payment Link */
  standard: "https://buy.stripe.com/fZuaEW83ggODaZ40Z19IQ06",
  /** Premium $899 / month の Payment Link */
  premium: "https://buy.stripe.com/28EfZg2IWeGv4AG2359IQ05",
  /** Stripe Customer Portal のログインリンク（Manage Subscription 用） */
  customerPortal: "https://billing.stripe.com/p/login/14A4gy3N08i7ebggXZ9IQ00",
} as const
