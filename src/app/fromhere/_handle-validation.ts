/**
 * FromHere ハンドルの正規化 / バリデーション。
 *
 * - DB の CHECK 制約 `^[a-z0-9_]{3,20}$` と完全に一致させること。
 * - 予約語リストは `public.newvibes_reserved_handles` テーブルにあり、
 *   DB トリガーで強制されるが、UX を良くするためにクライアント側でも軽くチェックする。
 *   実際の最終判定は DB が行うため、ここはあくまでヒント。
 */

/** DB の正規表現と一致 */
export const FROMHERE_HANDLE_REGEX = /^[a-z0-9_]{3,20}$/

/** UX 用の事前チェック。本物の禁止は DB のトリガー側 */
const HINT_RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "api",
  "app",
  "www",
  "fromhere",
  "gritvib",
  "login",
  "signin",
  "signup",
  "register",
  "logout",
  "settings",
  "account",
  "me",
  "you",
  "staff",
  "moderator",
  "mod",
  "official",
  "system",
  "null",
  "undefined",
  "about",
  "contact",
  "guide",
  "legal",
  "terms",
  "privacy",
  "discover",
  "skills",
  "chat",
  "inquiry",
  "mypage",
  "profile",
  "store",
])

/** 入力からハンドルを正規化（小文字 + 前後空白 + 先頭 @ 除去） */
export function normalizeFromHereHandle(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed
}

export type FromHereHandleValidationError = "format" | "reserved"

export type FromHereHandleValidationResult =
  | { ok: true; handle: string }
  | { ok: false; error: FromHereHandleValidationError; handle: string }

/**
 * 入力ハンドルを正規化しつつ、クライアント側で確実に弾けるエラー（書式 / 予約語）を返す。
 * 競合（同一ハンドル既出）はサーバー側（API + DB UNIQUE）で別途検証する。
 */
export function validateFromHereHandle(raw: string): FromHereHandleValidationResult {
  const handle = normalizeFromHereHandle(raw)
  if (!FROMHERE_HANDLE_REGEX.test(handle)) {
    return { ok: false, error: "format", handle }
  }
  if (HINT_RESERVED_HANDLES.has(handle)) {
    return { ok: false, error: "reserved", handle }
  }
  return { ok: true, handle }
}

/** 表示名のバリデーション（1〜50 文字） */
export function validateFromHereDisplayName(raw: string): boolean {
  const v = raw.trim()
  return v.length >= 1 && v.length <= 50
}

/** 自己紹介の長さ制限（最大 280 文字） */
export const FROMHERE_BIO_MAX_LENGTH = 280
