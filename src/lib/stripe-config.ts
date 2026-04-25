/** ブラウザで Stripe Elements / PaymentIntent フローを有効にする（Publishable Key が設定されているとき） */
export function isStripePaymentsConfigured(): boolean {
  const k = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  return typeof k === "string" && k.trim().length > 0
}
