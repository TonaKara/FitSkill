/**
 * FromHere ユーザーアバターの共用バリデーション。
 *
 * - クライアントの「画像を選んだ瞬間」と、サーバー側 PATCH API の双方で同じロジックを通す。
 * - クライアント検証は信頼せず、サーバー側で path 形式 + storage 上の実在を再確認する。
 */

/** Storage bucket 名（migrations と一致させる） */
export const FROMHERE_AVATARS_BUCKET = "newvibes-avatars"

/** 上限ファイルサイズ (bytes) — migrations の file_size_limit と揃える */
export const FROMHERE_AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** 許可する MIME type */
export const FROMHERE_AVATAR_ALLOWED_MIME: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
]

/** path 文字列の最大長（DB の check 制約と揃える） */
export const FROMHERE_AVATAR_PATH_MAX_LENGTH = 500

/** path の許容形式: `<uid uuid>/<random>.<ext>` */
export const FROMHERE_AVATAR_PATH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,128}\.(png|jpe?g|webp)$/i

export type FromHereAvatarFileErrorKey =
  | "tooLarge"
  | "invalidType"
  | "noFile"

export type FromHereAvatarPathErrorKey =
  | "invalidPath"
  | "tooLong"

/**
 * File オブジェクトの安全性チェック（クライアントで使用）。
 */
export function validateFromHereAvatarFile(file: File | null | undefined):
  | { ok: true; file: File }
  | { ok: false; error: FromHereAvatarFileErrorKey } {
  if (!file) {
    return { ok: false, error: "noFile" }
  }
  if (!FROMHERE_AVATAR_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: "invalidType" }
  }
  if (file.size > FROMHERE_AVATAR_MAX_BYTES) {
    return { ok: false, error: "tooLarge" }
  }
  return { ok: true, file }
}

/**
 * Storage path の妥当性（API で再確認）。
 * - フォーマット規則: `<uid>/<filename>.<ext>`
 * - uid は authenticated user の id と一致するかは API レイヤーで別途検証する
 */
export function validateFromHereAvatarPath(value: unknown):
  | { ok: true; path: string }
  | { ok: false; error: FromHereAvatarPathErrorKey } {
  const path = typeof value === "string" ? value.trim() : ""
  if (path.length === 0 || path.length > FROMHERE_AVATAR_PATH_MAX_LENGTH) {
    return { ok: false, error: "tooLong" }
  }
  if (!FROMHERE_AVATAR_PATH_REGEX.test(path)) {
    return { ok: false, error: "invalidPath" }
  }
  return { ok: true, path }
}

/**
 * 拡張子の取り出し（File.name から推測）。
 * - クライアントでアップロード前に決定する用途。
 */
export function inferFromHereAvatarExtension(file: File): "png" | "jpg" | "webp" {
  const mime = file.type.toLowerCase()
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}
