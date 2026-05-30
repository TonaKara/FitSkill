/**
 * FromHere コメントの共用バリデーション。
 *
 * 設計の原則:
 * - クライアントのフォームと、サーバー側 POST API の双方で同じロジックを通す。
 * - **クライアント検証は信頼しない**。最終判定はサーバー側で再実行する。
 * - HTML タグや危険なスキーマは投稿前の段階で拒否する（XSS の入口を絞る）。
 */

export const FROMHERE_COMMENT_MAX_LENGTH = 400

/** UUID v4 (簡易) — product_id / parent_id の形式チェック用 */
export const FROMHERE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FromHereCommentInput = {
  body: unknown
  productId: unknown
  parentId?: unknown
}

export type FromHereCommentErrorKey =
  | "empty"
  | "tooLong"
  | "invalidProductId"
  | "invalidParentId"
  | "containsHtml"

export type FromHereCommentSanitized = {
  body: string
  productId: string
  parentId: string | null
}

export type FromHereCommentValidation =
  | { ok: true; value: FromHereCommentSanitized }
  | { ok: false; error: FromHereCommentErrorKey }

/** ----------------------------------------------------------
 *  単一の本文サニタイズ — HTML タグ・script: などのスキーマを拒否
 * ---------------------------------------------------------- */
function looksLikeHtml(value: string): boolean {
  // <tag> / </tag> / <tag /> パターンを検出する。
  // markdown の `<code>` 系もブロックしてしまうが、コメントは plain text 想定なので許容。
  return /<\s*\/?\s*[a-zA-Z][^>]*>/.test(value)
}

/**
 * コメント本文だけを検証して正規化する。
 *
 * - `productId` を持たない文脈（例: プロダクト投稿時に同時送信する「最初のコメント」）
 *   からも利用するため、本文検証だけを分離した。
 * - 入力が `null` / `undefined` / 空文字なら `empty` を返す。呼び出し側で「任意項目
 *   としてスキップしたい」場合は事前に空文字判定を行うこと。
 */
export type FromHereCommentBodyValidation =
  | { ok: true; body: string }
  | { ok: false; error: Extract<FromHereCommentErrorKey, "empty" | "tooLong" | "containsHtml"> }

export function validateFromHereCommentBody(raw: unknown): FromHereCommentBodyValidation {
  const bodyRaw = typeof raw === "string" ? raw : ""
  const normalized = bodyRaw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (normalized.length === 0) {
    return { ok: false, error: "empty" }
  }
  if (normalized.length > FROMHERE_COMMENT_MAX_LENGTH) {
    return { ok: false, error: "tooLong" }
  }
  if (looksLikeHtml(normalized)) {
    return { ok: false, error: "containsHtml" }
  }
  return { ok: true, body: normalized }
}

export function validateFromHereCommentInput(
  input: FromHereCommentInput,
): FromHereCommentValidation {
  const bodyValidation = validateFromHereCommentBody(input.body)
  if (!bodyValidation.ok) {
    return { ok: false, error: bodyValidation.error }
  }

  const productId = typeof input.productId === "string" ? input.productId.trim() : ""
  if (!FROMHERE_UUID_REGEX.test(productId)) {
    return { ok: false, error: "invalidProductId" }
  }

  const parentIdRaw = typeof input.parentId === "string" ? input.parentId.trim() : ""
  let parentId: string | null = null
  if (parentIdRaw.length > 0) {
    if (!FROMHERE_UUID_REGEX.test(parentIdRaw)) {
      return { ok: false, error: "invalidParentId" }
    }
    parentId = parentIdRaw
  }

  return { ok: true, value: { body: bodyValidation.body, productId, parentId } }
}
