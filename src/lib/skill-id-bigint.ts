/**
 * `skills.id` / `inquiry_messages.origin_skill_id` は DB 上 bigint。
 * PostgREST / JSON では文字列で届くことが多く、number だと安全整数を超えた場合に誤差が出る。
 * クエリでは常に正規化した十進文字列を使う。
 */

const DIGITS_ONLY = /^\d+$/

export function normalizeSkillBigIntId(value: unknown): string | null {
  if (value == null) {
    return null
  }
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null
    }
    if (!Number.isSafeInteger(value)) {
      return null
    }
    return String(value)
  }
  const s = String(value).trim()
  if (!DIGITS_ONLY.test(s)) {
    return null
  }
  return s
}

/** `.in("id", ids)` などに渡す重複なしのスキル ID 文字列リスト */
export function uniqueSkillBigIntIds(ids: Iterable<unknown>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of ids) {
    const n = normalizeSkillBigIntId(v)
    if (n != null && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}
