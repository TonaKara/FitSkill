/** Stripe 売上・振込まわりの暫定デバッグ表示（原因切り分け用） */
export function formatStripePayoutOperationErrorMessage(
  detail: string | null | undefined,
  fallback: string,
): string {
  const trimmed = detail?.trim()
  if (!trimmed) {
    return fallback
  }
  if (trimmed === fallback) {
    return trimmed
  }
  return `${fallback} 詳細: ${trimmed}`
}
