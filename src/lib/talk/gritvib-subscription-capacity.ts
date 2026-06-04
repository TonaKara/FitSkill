/**
 * チャット送信可否・有効人数・管理一覧で共通の「有効サブスク」判定。
 * Stripe Webhook が `subscription_status` と `subscription_current_period_end` を同期する。
 */
export function isGritvibChatSubscriptionActive(
  subscriptionStatus: string,
  subscriptionCurrentPeriodEnd: string | null,
): boolean {
  if (subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
    return false
  }
  if (!subscriptionCurrentPeriodEnd) return true
  return new Date(subscriptionCurrentPeriodEnd).getTime() > Date.now()
}

/** 管理画面のステータス表示（期間終了も反映）。 */
export function describeGritvibChatSubscriptionStatus(
  subscriptionStatus: string,
  subscriptionCurrentPeriodEnd: string | null,
): string {
  if (isGritvibChatSubscriptionActive(subscriptionStatus, subscriptionCurrentPeriodEnd)) {
    return subscriptionStatus === "trialing" ? "トライアル中" : "有効"
  }
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "期限切れ"
  }
  switch (subscriptionStatus) {
    case "past_due":
      return "支払期限超過"
    case "canceled":
      return "解約済み"
    case "incomplete":
      return "未完了"
    case "incomplete_expired":
      return "未完了 (期限切れ)"
    case "unpaid":
      return "未払い"
    case "paused":
      return "一時停止"
    case "inactive":
      return "未加入"
    default:
      return subscriptionStatus || "不明"
  }
}

/** 管理画面・チャット UI 共通のサブスク枠状態。 */
export type GritvibSubscriptionCapacityStatus = {
  activeCount: number
  /** DB 未設定時は null（表示・判定上は 0 人として扱う）。 */
  capacityMax: number | null
  acceptingNew: boolean
}

/** 未設定（null）を 0 人として扱う。 */
export function gritvibEffectiveCapacityMax(capacityMax: number | null): number {
  return capacityMax ?? 0
}

export function buildGritvibSubscriptionCapacityStatus(input: {
  activeCount: number | string
  capacityMax: number | null
}): GritvibSubscriptionCapacityStatus {
  const activeCount = Number(input.activeCount)
  const capacityMax = input.capacityMax
  const effectiveMax = gritvibEffectiveCapacityMax(capacityMax)
  return {
    activeCount: Number.isFinite(activeCount) ? activeCount : 0,
    capacityMax,
    acceptingNew: activeCount < effectiveMax,
  }
}

export function finalizeGritvibSubscriptionCapacityStatus(
  status: GritvibSubscriptionCapacityStatus,
): GritvibSubscriptionCapacityStatus {
  const effectiveMax = gritvibEffectiveCapacityMax(status.capacityMax)
  return {
    ...status,
    acceptingNew: status.activeCount < effectiveMax,
  }
}

export function mapGritvibSubscriptionCapacityRow(row: {
  active_count: number | string
  capacity_max: number | null
  accepting_new: boolean | string | null
}): GritvibSubscriptionCapacityStatus {
  const fromRpc =
    row.accepting_new === true ||
    row.accepting_new === "true" ||
    row.accepting_new === "t"
  if (row.accepting_new != null) {
    return finalizeGritvibSubscriptionCapacityStatus({
      activeCount: Number(row.active_count),
      capacityMax: row.capacity_max,
      acceptingNew: fromRpc,
    })
  }
  return buildGritvibSubscriptionCapacityStatus({
    activeCount: row.active_count,
    capacityMax: row.capacity_max,
  })
}
