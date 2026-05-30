/**
 * FromHere プロフィール編集の共用バリデーション。
 *
 * 設計の原則:
 * - クライアント側のフォーム / サーバー側 PATCH API で同一ロジックを使う。
 * - 「型」「長さ」「最小限のサニタイズ」のみを担当し、認可（本人かどうか）は呼び出し側が担う。
 * - **クライアントの検証は信頼しない**。最終判定は必ずサーバー側で行う。
 */

import { FROMHERE_BIO_MAX_LENGTH } from "@/fromhere/_handle-validation"

export const FROMHERE_DISPLAY_NAME_MIN = 1
export const FROMHERE_DISPLAY_NAME_MAX = 50

export { FROMHERE_BIO_MAX_LENGTH }

export type FromHereProfileEditInput = {
  displayName: unknown
  bio: unknown
}

export type FromHereProfileEditErrorKey =
  | "displayNameRequired"
  | "displayNameTooLong"
  | "bioTooLong"

export type FromHereProfileEditSanitized = {
  displayName: string
  /** 空欄を保存したい場合は null を使う（DB の NULL に対応） */
  bio: string | null
}

export type FromHereProfileEditValidation =
  | { ok: true; value: FromHereProfileEditSanitized }
  | { ok: false; error: FromHereProfileEditErrorKey }

/**
 * 編集ペイロードを検証 + サニタイズして返す。
 * - display_name は trim 後の長さで判定（前後空白は許可しない方針）。
 * - bio は trim 後に長さチェック、空欄なら null を返す。
 *   → DB 側 (`newvibes_profiles.bio`) は NULL 許容なので、空文字列ではなく NULL で表現する。
 */
export function validateFromHereProfileEdit(
  input: FromHereProfileEditInput,
): FromHereProfileEditValidation {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : ""
  if (displayName.length < FROMHERE_DISPLAY_NAME_MIN) {
    return { ok: false, error: "displayNameRequired" }
  }
  if (displayName.length > FROMHERE_DISPLAY_NAME_MAX) {
    return { ok: false, error: "displayNameTooLong" }
  }

  const bioRaw = typeof input.bio === "string" ? input.bio.trim() : ""
  if (bioRaw.length > FROMHERE_BIO_MAX_LENGTH) {
    return { ok: false, error: "bioTooLong" }
  }
  const bio = bioRaw.length === 0 ? null : bioRaw

  return { ok: true, value: { displayName, bio } }
}
