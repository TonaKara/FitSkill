/**
 * FromHere の連続ログイン日数まわり (newvibes_login_streaks) の共有ロジック。
 *
 * - JST (Asia/Tokyo) 0:00 を 1 日の区切りとする。
 * - 「昨日のログイン続き」かどうかの判定は JST 日付ベース。
 * - i18n キーや UI 上のラベルは含まず、純粋なドメイン計算のみを置く。
 * - client / server 両方から読み込めるよう `"use client"` 等は付けない。
 */

/** ----------------------------------------------------------
 *  バッジしきい値（連続日数）
 *  - 高い方を優先。最大バッジは 365 日。
 *  - id は i18n キー / DB 等で安定的に参照する識別子。
 * ---------------------------------------------------------- */
export const LOGIN_STREAK_BADGES = [
  { id: "year365", threshold: 365 },
  { id: "century100", threshold: 100 },
  { id: "twoMonth60", threshold: 60 },
  { id: "month30", threshold: 30 },
  { id: "fortnight14", threshold: 14 },
  { id: "week7", threshold: 7 },
  { id: "starter3", threshold: 3 },
] as const

export type LoginStreakBadgeId = (typeof LOGIN_STREAK_BADGES)[number]["id"]

/** バッジ id ごとのしきい値マップ */
export const LOGIN_STREAK_BADGE_THRESHOLDS: Record<LoginStreakBadgeId, number> = (() => {
  const acc = {} as Record<LoginStreakBadgeId, number>
  for (const b of LOGIN_STREAK_BADGES) {
    acc[b.id] = b.threshold
  }
  return acc
})()

/**
 * 現在の連続日数から取得済みの最高バッジを返す。
 * - しきい値を満たさない場合は null。
 */
export function getCurrentLoginStreakBadge(currentStreak: number): LoginStreakBadgeId | null {
  for (const badge of LOGIN_STREAK_BADGES) {
    if (currentStreak >= badge.threshold) {
      return badge.id
    }
  }
  return null
}

/**
 * 次のバッジ id と、あと何日でそれが解放されるかを返す。
 * - 全バッジ獲得済みなら null。
 */
export function getNextLoginStreakBadge(
  currentStreak: number,
): { id: LoginStreakBadgeId; threshold: number; daysToGo: number } | null {
  /** 低い順に走査して、まだ達していないバッジを探す */
  const ascending = [...LOGIN_STREAK_BADGES].sort((a, b) => a.threshold - b.threshold)
  for (const badge of ascending) {
    if (currentStreak < badge.threshold) {
      return {
        id: badge.id,
        threshold: badge.threshold,
        daysToGo: badge.threshold - currentStreak,
      }
    }
  }
  return null
}

/** ----------------------------------------------------------
 *  JST 日付（YYYY-MM-DD）ユーティリティ
 *  - サーバ / クライアントどちらでもタイムゾーンを固定して動かす。
 * ---------------------------------------------------------- */

/**
 * 任意の Date / ISO 文字列を JST の `YYYY-MM-DD` に正規化する。
 * 不正値は null。
 */
export function toJstDateString(input: Date | string | null | undefined): string | null {
  if (input == null) {
    return null
  }
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  /**
   * Intl.DateTimeFormat の `en-CA` ロケールは `YYYY-MM-DD` 形式を返すので、
   * timeZone: "Asia/Tokyo" と組み合わせて JST 日付に変換する。
   */
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const d = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !d) {
    return null
  }
  return `${y}-${m}-${d}`
}

/** `YYYY-MM-DD` 同士の日数差。a と b の差が `b - a` 日。 */
export function diffJstDays(a: string, b: string): number | null {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    return null
  }
  const msPerDay = 86_400_000
  return Math.round((tb - ta) / msPerDay)
}

/**
 * 連続ログインの次の状態を計算する。
 *
 * @param prev 直前の状態（無ければ undefined）
 * @param todayJst 今日の JST 日付文字列 `YYYY-MM-DD`
 * @returns 次の状態 + 変更があったかどうか
 */
export function computeNextStreak(
  prev:
    | {
        currentStreak: number
        longestStreak: number
        lastLoginDate: string
      }
    | null
    | undefined,
  todayJst: string,
): {
  currentStreak: number
  longestStreak: number
  lastLoginDate: string
  changed: boolean
} {
  if (!prev) {
    return {
      currentStreak: 1,
      longestStreak: 1,
      lastLoginDate: todayJst,
      changed: true,
    }
  }

  if (prev.lastLoginDate === todayJst) {
    /** 同日中の再アクセス。何も変えない（更新も不要）。 */
    return {
      currentStreak: prev.currentStreak,
      longestStreak: prev.longestStreak,
      lastLoginDate: prev.lastLoginDate,
      changed: false,
    }
  }

  const diff = diffJstDays(prev.lastLoginDate, todayJst)
  let nextCurrent: number
  if (diff === 1) {
    nextCurrent = Math.max(1, prev.currentStreak) + 1
  } else if (diff !== null && diff > 1) {
    nextCurrent = 1
  } else {
    /**
     * diff が 0 以下 / null（不正データ）の場合は安全側で 1 にリセット。
     * 「未来日付が記録されてしまう」ような事故ケースも、新しい todayJst で書き直すことで補正する。
     */
    nextCurrent = 1
  }
  const nextLongest = Math.max(prev.longestStreak, nextCurrent)
  return {
    currentStreak: nextCurrent,
    longestStreak: nextLongest,
    lastLoginDate: todayJst,
    changed: true,
  }
}

/** ----------------------------------------------------------
 *  共通型
 * ---------------------------------------------------------- */

export type LoginStreakSummary = {
  currentStreak: number
  longestStreak: number
  lastLoginDate: string | null
  currentBadge: LoginStreakBadgeId | null
}

export function summarizeStreak(
  row: { current_streak: number; longest_streak: number; last_login_date: string | null } | null,
): LoginStreakSummary {
  const current = row?.current_streak ?? 0
  return {
    currentStreak: current,
    longestStreak: row?.longest_streak ?? 0,
    lastLoginDate: row?.last_login_date ?? null,
    currentBadge: getCurrentLoginStreakBadge(current),
  }
}
