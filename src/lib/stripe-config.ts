/** ブラウザで Stripe Elements / PaymentIntent フローを有効にする（Publishable Key が設定されているとき） */
export function getStripePublishableKey(): string | null {
  const candidates = [process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, process.env.STRIPE_PUBLIC_KEY]
  for (const raw of candidates) {
    const value = raw?.trim()
    if (value) {
      return value
    }
  }
  return null
}

export function isStripePaymentsConfigured(): boolean {
  return getStripePublishableKey() !== null
}
