import type { SupabaseClient } from "@supabase/supabase-js"

export const AVATARS_STORAGE_BUCKET = "avatars"

const PUBLIC_MARKER = "/storage/v1/object/public/avatars/"

/** Storage アップロードで「バケットが存在しない」場合のエラー判定（マイグレーション未適用など） */
export function isStorageBucketNotFoundError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    const msg = typeof o.message === "string" ? o.message : ""
    if (/bucket not found/i.test(msg)) {
      return true
    }
    if (o.statusCode === 404 || o.statusCode === "404") {
      return true
    }
    if (o.error === "not_found" || o.error === "Bucket not found") {
      return true
    }
  }
  if (err instanceof Error && /bucket not found/i.test(err.message)) {
    return true
  }
  return false
}

/** Supabase Storage の公開 URL からオブジェクトパス（バケット名を除く）を取り出す */
export function extractAvatarStoragePathFromPublicUrl(publicUrl: string): string | null {
  const cleaned = publicUrl.trim().split(/[?#]/)[0] ?? ""
  const idx = cleaned.indexOf(PUBLIC_MARKER)
  if (idx === -1) {
    return null
  }
  try {
    return decodeURIComponent(cleaned.slice(idx + PUBLIC_MARKER.length))
  } catch {
    return null
  }
}

export function isAvatarStoragePathForUser(storagePath: string, userId: string): boolean {
  return storagePath.startsWith(`${userId}/`)
}

/** 同一 Supabase プロジェクト由来で、かつ本人フォルダ配下の公開 URL か */
export function isTrustedAvatarPublicUrlForUser(
  publicUrl: string,
  userId: string,
  supabaseProjectUrl: string,
): boolean {
  let expectedOrigin: string
  try {
    expectedOrigin = new URL(supabaseProjectUrl.replace(/\/$/, "")).origin
    const actualOrigin = new URL(publicUrl.trim()).origin
    if (actualOrigin !== expectedOrigin) {
      return false
    }
  } catch {
    return false
  }
  const path = extractAvatarStoragePathFromPublicUrl(publicUrl)
  if (!path) {
    return false
  }
  return isAvatarStoragePathForUser(path, userId)
}

/** avatars バケットに保存した自分の画像のみ削除 */
export async function removeAvatarObjectAtPublicUrl(
  supabase: SupabaseClient,
  userId: string,
  publicUrl: string | null | undefined,
): Promise<{ error: Error | null }> {
  const path = extractAvatarStoragePathFromPublicUrl(publicUrl ?? "")
  if (!path || !isAvatarStoragePathForUser(path, userId)) {
    return { error: null }
  }
  const { error } = await supabase.storage.from(AVATARS_STORAGE_BUCKET).remove([path])
  return { error: error ? new Error(error.message) : null }
}
