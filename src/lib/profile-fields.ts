/** profiles.category（複数カテゴリ想定: text[] / jsonb 配列など）を文字列配列に正規化 */
export function normalizeProfileCategory(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === "string")
  }
  return []
}
