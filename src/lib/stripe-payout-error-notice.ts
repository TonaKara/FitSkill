export const STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE =
  "ログイン状態を確認できませんでした。ページを再読み込みしてから、もう一度お試しください。"

function resolveStripePayoutOperationErrorDetail(detail: string): string | null {
  const normalized = detail.toLowerCase()
  if (
    normalized.includes("complete your platform profile") ||
    normalized.includes("connect/accounts/overview")
  ) {
    return "GritVib 側の Stripe Connect プラットフォーム設定（担当者アンケート）が未完了です。Stripe ダッシュボードの Connect 設定を開き、アンケートを完了してから再度お試しください。"
  }

  if (
    normalized.includes("updating stripe_connect_account_id is not allowed") ||
    normalized.includes("stripe_connect_account_id is not allowed")
  ) {
    return "Stripe 連携情報の保存に失敗しました。時間を置いて再度お試しください。"
  }

  if (
    detail === STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE ||
    normalized.includes("not_authenticated")
  ) {
    return STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE
  }

  if (normalized === "unauthorized") {
    return "Stripe 連携情報の保存に失敗しました。時間を置いて再度お試しください。"
  }

  if (normalized.includes("supabase admin environment variables are missing")) {
    return "Stripe 連携情報の保存設定が不足しています。時間を置いて再度お試しください。"
  }

  return null
}

/** Stripe 売上・振込まわりの暫定デバッグ表示（原因切り分け用） */
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
  return `${fallback} 詳細: ${trimmed}`
}

/**
 * Stripe 講師オンボーディング URL 取得失敗時のユーザー表示用（本番切り分け・一時運用）。
 * サーバーが `return { ok: false, error }` で返した文言をそのまま見せ、マッピングがある場合は案内を併記する。
 */
export function formatStripeOnboardingUrlErrorForUser(detail: string | null | undefined, fallback: string): string {
  const trimmed = detail?.trim()
  if (!trimmed) {
    return fallback
  }
  const mapped = resolveStripePayoutOperationErrorDetail(trimmed)
  if (!mapped || mapped === trimmed) {
    return trimmed
  }
  return `${trimmed}（案内: ${mapped}）`
}
