"use server"

import "server-only"

import { normalizeGritvibChatImagePath } from "@/lib/talk/chat-image-path"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireActionUser } from "@/lib/supabase/action-auth"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

const STORAGE_BUCKET = "gritvib-chat-photos"
const SIGNED_URL_TTL_SEC = 3600

export type SignGritvibChatImagePathsResult =
  | { ok: true; urls: Record<string, string> }
  | { ok: false; reason: "unauthenticated" | "internal" }

/**
 * チャット画像の signed URL をサーバーで発行する。
 *
 * クライアントの `createSignedUrl` は Storage RLS に依存するため、運営添付画像などで
 * 失敗しやすい。ここではメッセージ閲覧権限を確認したうえで service role で署名する。
 */
export async function signGritvibChatImagePathsAction(
  paths: string[],
): Promise<SignGritvibChatImagePathsResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    logTalkServerError("[talk/chat-images] service role client unavailable")
    return { ok: false, reason: "internal" }
  }

  const { supabase, user } = sessionResult.session
  const unique = [
    ...new Set(
      paths
        .map((p) => normalizeGritvibChatImagePath(p))
        .filter((p) => p.length > 0),
    ),
  ]
  if (unique.length === 0) {
    return { ok: true, urls: {} }
  }

  const allowed = new Set<string>()
  for (const path of unique) {
    if (path.startsWith(`${user.id}/`)) {
      allowed.add(path)
    }
  }

  const needsMessageCheck = unique.filter((p) => !allowed.has(p))
  if (needsMessageCheck.length > 0) {
    const { data: rows, error } = await supabase
      .from("gritvib_chat_messages")
      .select("image_path")
      .in("image_path", needsMessageCheck)
      .not("image_path", "is", null)

    if (error) {
      logTalkServerError("[talk/chat-images] message access check failed", error)
      return { ok: false, reason: "internal" }
    }

    for (const row of rows ?? []) {
      const imagePath = row.image_path
      if (typeof imagePath === "string" && imagePath.length > 0) {
        allowed.add(normalizeGritvibChatImagePath(imagePath))
      }
    }
  }

  const urls: Record<string, string> = {}
  await Promise.all(
    [...allowed].map(async (path) => {
      const { data, error } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC)
      if (error || !data?.signedUrl) {
        logTalkServerError("[talk/chat-images] admin createSignedUrl failed")
        return
      }
      urls[path] = data.signedUrl
    }),
  )

  return { ok: true, urls }
}
