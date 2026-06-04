/**
 * GritVib (人間チャットサービス) のニックネームバリデーション。
 *
 * クライアント / サーバーいずれからも import される共通ロジック。
 *
 * ルール:
 *   - 2〜20 文字
 *   - 使用可能文字: 半角英数字 / ひらがな / カタカナ / 漢字 / アンダースコア / ハイフン
 *   - 前後の空白は trim される
 *   - 完全一致での重複は DB の unique index (lower(nickname)) が最終担保。本モジュールは形式チェックのみ。
 */

export const GRITVIB_NICKNAME_MIN_LENGTH = 2
export const GRITVIB_NICKNAME_MAX_LENGTH = 20

export type GritvibNicknameValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: GritvibNicknameInvalidReason }

export type GritvibNicknameInvalidReason =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars"

/**
 * 許容文字パターン。
 *   - 半角英数字
 *   - ひらがな (U+3040–U+309F)
 *   - カタカナ (U+30A0–U+30FF, U+31F0–U+31FF)
 *   - CJK 統合漢字 (U+4E00–U+9FFF) + 拡張 A (U+3400–U+4DBF)
 *   - 長音記号「ー」(U+30FC) はカタカナ範囲に含まれる
 *   - アンダースコア / ハイフン
 *
 * 空白・記号・絵文字などは禁止。
 */
const ALLOWED_NICKNAME_PATTERN =
  /^[A-Za-z0-9_\-\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF]+$/

export function validateGritvibNickname(raw: string): GritvibNicknameValidationResult {
  const value = (raw ?? "").trim()
  if (value.length === 0) {
    return { ok: false, reason: "empty" }
  }
  if (value.length < GRITVIB_NICKNAME_MIN_LENGTH) {
    return { ok: false, reason: "too_short" }
  }
  if (value.length > GRITVIB_NICKNAME_MAX_LENGTH) {
    return { ok: false, reason: "too_long" }
  }
  if (!ALLOWED_NICKNAME_PATTERN.test(value)) {
    return { ok: false, reason: "invalid_chars" }
  }
  return { ok: true, value }
}

/**
 * 同一性比較 (case-insensitive)。
 * DB の unique index と同じルールでローカル判定したい時用。
 */
export function isSameGritvibNickname(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
