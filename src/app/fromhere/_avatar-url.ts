/**
 * FromHere アバター画像の公開 URL 解決ヘルパ。
 *
 * 仕様（2026-05 再改訂）:
 * - FromHere のプロフィールは GritVib 本体 `profiles` 行が存在しないユーザーもいるため、
 *   信頼できる source は **`newvibes_profiles.avatar_url`** とする。
 * - 表示時の優先順位は以下:
 *     1. `newvibes_profiles.avatar_url`（FromHere 側の正本）
 *     2. 本体 `profiles.avatar_url`（参照のみ、FromHere からは書き込まない）
 *     3. 旧 `newvibes-avatars` バケットの `avatar_path`（互換用フォールバック）
 *     4. null（呼び出し側で fallback を描画）
 *
 * SSR/CSR の双方から呼べるよう `process.env.NEXT_PUBLIC_*` のみ参照する。
 */

import { FROMHERE_AVATARS_BUCKET } from "@/fromhere/_avatar-validation"

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

/**
 * Supabase Storage の `newvibes-avatars` バケットにおける public URL を組み立てる。
 * 互換性のためにのみ使われる。新規アップロードは本体の `avatars` バケットを使用する。
 */
export function buildFromHereAvatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!base) {
    return null
  }
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${FROMHERE_AVATARS_BUCKET}/${encodeStoragePath(path)}`
}

export type AvatarSource = {
  /** `newvibes_profiles.avatar_url`（FromHere 側の正本、最優先） */
  avatarUrl?: string | null
  /** 本体 `profiles.avatar_url`（参照のみ、FromHere 行が無い場合のフォールバック） */
  mainAvatarUrl?: string | null
  /** 旧 `newvibes_profiles.avatar_path`（互換） */
  avatarPath?: string | null
}

/**
 * アバターの表示用 URL を確定させる。
 *
 * 優先順位:
 *   1. `newvibes_profiles.avatar_url`
 *   2. 本体 `profiles.avatar_url`
 *   3. 旧 `avatar_path` 由来の URL
 */
export function resolveFromHereAvatarUrl(source: AvatarSource): string | null {
  const direct = source.avatarUrl?.trim() ?? ""
  if (direct.length > 0) {
    return direct
  }
  const main = source.mainAvatarUrl?.trim() ?? ""
  if (main.length > 0) {
    return main
  }
  const fromPath = buildFromHereAvatarPublicUrl(source.avatarPath ?? null)
  if (fromPath) {
    return fromPath
  }
  return null
}
