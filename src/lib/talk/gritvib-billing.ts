import type { Locale } from "@/lib/i18n/locales"
import { TALK_STRIPE_LINKS } from "@/talk/_stripe-links"

/**
 * GritVib サブスクの決済リンクをロケールに応じて返す。
 * 動線は共通（Payment Link → Webhook → チャット）。通貨だけ JPY / USD で分岐。
 */
export function getGritvibSubscriptionPaymentLink(locale: Locale): string {
  if (locale === "en") {
    const fromEnv = process.env.NEXT_PUBLIC_STRIPE_GRITVIB_PAYMENT_LINK_URL_USD?.trim()
    if (fromEnv) return fromEnv
    const fromConstant = TALK_STRIPE_LINKS.subscriptionUsd.trim()
    if (fromConstant) return fromConstant
  }
  return TALK_STRIPE_LINKS.subscription
}
