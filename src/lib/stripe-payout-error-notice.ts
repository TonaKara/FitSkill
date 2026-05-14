export const STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE =
  "ログイン状態を確認できませんでした。ページを再読み込みしてから、もう一度お試しください。"

function resolveStripePayoutOperationErrorDetail(detail: string): string | null {
  const normalized = detail.toLowerCase()
  if (
    normalized.includes("complete your platform profile") ||
    normalized.includes("connect/accounts/overview")
  ) {
    return "振込先の登録を続行するための準備が整っていません。時間を置いて再度お試しください。解決しない場合はお問い合わせください。"
  }

  if (
    normalized.includes("updating stripe_connect_account_id is not allowed") ||
    normalized.includes("stripe_connect_account_id is not allowed")
  ) {
    return "Stripe 連携情報の保存に失敗しました。時間を置いて再度お試しください。"
  }

  // DB の BEFORE UPDATE 等で Unauthorized（P0001）が返るケース（service_role では auth.uid() が NULL）
  if (normalized === "unauthorized") {
    return "振込先の情報を保存できませんでした。時間を置いて再度お試しください。解決しない場合はお問い合わせください。"
  }

  if (
    detail === STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE ||
    normalized.includes("not_authenticated")
  ) {
    return STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE
  }

  if (normalized.includes("supabase admin environment variables are missing")) {
    return "Stripe 連携情報の保存設定が不足しています。時間を置いて再度お試しください。"
  }

  return null
}

/** Stripe 売上・振込まわりのユーザー向けエラー文言 */
export function formatStripePayoutOperationErrorMessage(
  detail: string | null | undefined,
  fallback: string,
): string {
  const trimmed = detail?.trim()
  if (!trimmed) {
    return fallback
  }

  const mapped = resolveStripePayoutOperationErrorDetail(trimmed)
  if (mapped) {
    return mapped
  }

  if (trimmed === fallback) {
    return trimmed
  }
  return fallback
}

/**
 * Stripe 講師オンボーディング URL 取得失敗時のユーザー表示用。
 */
export function formatStripeOnboardingUrlErrorForUser(detail: string | null | undefined, fallback: string): string {
  const trimmed = detail?.trim()
  if (!trimmed) {
    return fallback
  }
  const mapped = resolveStripePayoutOperationErrorDetail(trimmed)
  if (mapped) {
    return mapped
  }
  return fallback
}
