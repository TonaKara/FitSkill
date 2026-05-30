"use client"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import {
  FROMHERE_ALLOWED_IMAGE_MIME,
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_APP_ICON_MAX_BYTES,
  FROMHERE_SCREENSHOTS_BUCKET,
  FROMHERE_SCREENSHOT_MAX_BYTES,
  isAllowedImageMime,
  type FromHereAllowedImageMime,
} from "@/fromhere/_product-validation"

export type FromHereUploadKind = "app_icon" | "screenshot"

export type FromHereUploadResult =
  | { ok: true; path: string; publicUrl: string }
  | { ok: false; reason: "auth" | "type" | "size" | "upload" }

const MIME_EXT: Record<FromHereAllowedImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/** 画像 1 ファイルを Supabase Storage にアップロードして path / publicUrl を返す。
 *
 * - バケットは kind により振り分ける（`newvibes-app-icons` or `newvibes-screenshots`）。
 * - path は `<auth.uid>/<random>.<ext>` 形式。Storage policy で先頭フォルダ＝自分の uid を強制している。
 * - クライアント側でも MIME / サイズの軽い事前チェックを行うが、最終判定はバケットの設定に従う。
 */
export async function uploadFromHereImage(
  kind: FromHereUploadKind,
  file: File,
): Promise<FromHereUploadResult> {
  if (!file) {
    return { ok: false, reason: "type" }
  }
  if (!isAllowedImageMime(file.type)) {
    return { ok: false, reason: "type" }
  }
  if (!FROMHERE_ALLOWED_IMAGE_MIME.includes(file.type as FromHereAllowedImageMime)) {
    return { ok: false, reason: "type" }
  }
  const maxBytes = kind === "app_icon" ? FROMHERE_APP_ICON_MAX_BYTES : FROMHERE_SCREENSHOT_MAX_BYTES
  if (file.size > maxBytes) {
    return { ok: false, reason: "size" }
  }

  const supabase = getSupabaseBrowserClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user?.id) {
    return { ok: false, reason: "auth" }
  }
  const userId = userData.user.id

  const ext = MIME_EXT[file.type as FromHereAllowedImageMime]
  const rand = generateRandomKey()
  const path = `${userId}/${rand}.${ext}`
  const bucketId = kind === "app_icon" ? FROMHERE_APP_ICONS_BUCKET : FROMHERE_SCREENSHOTS_BUCKET

  const { error: uploadError } = await supabase.storage.from(bucketId).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    return { ok: false, reason: "upload" }
  }

  const { data: publicData } = supabase.storage.from(bucketId).getPublicUrl(path)
  return { ok: true, path, publicUrl: publicData.publicUrl }
}

/** Storage 上の不要オブジェクトを削除。失敗は無視（next の upload 成功優先） */
export async function removeFromHereImage(kind: FromHereUploadKind, path: string): Promise<void> {
  if (!path) {
    return
  }
  const supabase = getSupabaseBrowserClient()
  const bucketId = kind === "app_icon" ? FROMHERE_APP_ICONS_BUCKET : FROMHERE_SCREENSHOTS_BUCKET
  try {
    await supabase.storage.from(bucketId).remove([path])
  } catch {
    /* noop */
  }
}

/** 16 進数 16 文字程度のランダム識別子を生成（ファイル名衝突回避用） */
function generateRandomKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24)
  }
  // SSR / 古い環境のフォールバック（実質クライアントでしか呼ばれない想定）
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
