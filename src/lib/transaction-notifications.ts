import type { SupabaseClient } from "@supabase/supabase-js"

/** DB `notifications.type` 用。アプリ内で統一して使う。 */
export const NOTIFICATION_TYPE = {
  purchase: "purchase",
  message: "message",
  completion_request: "completion_request",
  completion_approved: "completion_approved",
  review: "review",
  dispute: "dispute",
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]

export interface Notification {
  id: string
  recipient_id: string | null
  sender_id: string | null
  type: string
  title: string | null
  reason: string | null
  content: string | null
  is_admin_origin: boolean
  is_read: boolean
  created_at: string
}
export type NotificationRow = Notification

export type NotificationError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
  /** PostgREST の HTTP ステータス（`supabase.rpc` の応答から取れる場合） */
  status?: number | null
  statusText?: string | null
}

/** `send_admin_notification(p_title, p_reason, p_content, p_target_user_id)` に渡す引数 */
export type CreateAnnouncementParams = {
  title: string
  reason: string | null
  content: string
  target_user_id: string | null
}

/**
 * PostgREST 用 `send_admin_notification` の引数。
 */
type CreateAnnouncementRpcPayload = {
  p_title: string
  p_reason: string | null
  p_content: string
  p_target_user_id?: string
}

function parseRpcTargetUserId(value: string | null): string | null {
  if (value == null) return null
  const t = value.trim()
  return t === "" ? null : t
}

function parseRpcReason(value: string | null): string | null {
  if (value == null) return null
  const t = value.trim()
  return t === "" ? null : t
}

/**
 * `send_admin_notification` 失敗時にユーザー向けトーストへ出す短い文言。
 * 403/404 は HTTP ステータス、それ以外は DB 例外メッセージも見る。
 */
export function userFacingAnnouncementRpcMessage(error: NotificationError): string {
  const s = error.status ?? null
  if (s === 403) {
    return "管理権限がありません。この操作を行う権限がありません。"
  }
  if (s === 404) {
    return "お知らせ配信の呼び先が見つかりません。RPC がデプロイされているか、API 設定を確認してください。"
  }
  const msg = error.message ?? ""
  if (/admin_required/i.test(msg) || msg.includes("admin_required")) {
    return "管理権限がありません。この操作を行う権限がありません。"
  }
  if (/not_authenticated/i.test(msg) || msg.includes("not_authenticated")) {
    return "ログインが必要です。セッションを確認してください。"
  }
  const maybeSchemaIssue =
    msg.includes("send_admin_notification") ||
    msg.includes("schema cache") ||
    msg.includes("Could not find the function")
  if (maybeSchemaIssue) {
    return `お知らせ配信に失敗しました: ${msg}（Supabase の API スキーマをリロード済みか確認してください）`
  }
  return `お知らせ配信に失敗しました: ${msg}`
}

function logRpcFailure(
  label: string,
  payload: {
    error: { message: string; code?: string; details?: string; hint?: string }
    status: number | null
    statusText: string | null
    rpcName: string
    args: Record<string, unknown>
  },
) {
  const { error, status, statusText, rpcName, args } = payload
  console.error(`[${label}] ${rpcName} RPC failed`, {
    httpStatus: status,
    httpStatusText: statusText,
    message: error.message,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    args,
    errorSerialized: (() => {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error))
      } catch {
        return String(error)
      }
    })(),
  })
}

function logSupabaseError(label: string, err: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(label, {
    message: err.message,
    code: err.code ?? null,
    details: err.details ?? null,
    hint: err.hint ?? null,
  })
}

/**
 * 取引・チャット向けの通常通知（非管理者発信）。
 * `create_notification` RPC は旧スキーマ向けのため、RLS 可能な `notifications` 直接 INSERT を使う。
 * 送信者は常に `supabase.auth.getUser()` のユーザーと一致する必要がある（`notifications_insert_as_sender`）。
 */
export async function sendNotification(
  supabase: SupabaseClient,
  recipientId: string,
  type: string,
  content: string,
  options?: { reason?: string | null },
): Promise<{ error: NotificationError | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("通知作成失敗: 未ログイン")
    return { error: { message: "未ログインです" } }
  }
  if (recipientId === user.id) {
    return { error: { message: "invalid_recipient" } }
  }

  const { error } = await supabase.from("notifications").insert({
    recipient_id: recipientId,
    sender_id: user.id,
    type,
    content,
    is_read: false,
    is_admin_origin: false,
    title: null,
    reason: options?.reason != null && String(options.reason).trim() ? String(options.reason).trim() : null,
  })

  if (error) {
    logSupabaseError("通知作成失敗", error)
  }
  return {
    error: error
      ? {
          message: error.message,
          code: (error as { code?: string }).code ?? null,
          details: (error as { details?: string }).details ?? null,
          hint: (error as { hint?: string }).hint ?? null,
        }
      : null,
  }
}

/**
 * 取引まわりの通知用。内部で `sendNotification` / `create_notification` RPC を使う。
 */
export async function createTransactionNotification(
  supabase: SupabaseClient,
  params: {
    recipient_id: string
    type: string
    content: string
    /** 例: `transaction_id:` + UUID（通知タップでチャットへ遷移するのに使う） */
    reason?: string | null
  },
): Promise<{ error: NotificationError | null }> {
  return sendNotification(supabase, params.recipient_id, params.type, params.content, {
    reason: params.reason,
  })
}

export async function fetchGeneralNotifications(
  supabase: SupabaseClient,
  userId: string,
  adminOrigin: boolean,
  limit = 50,
): Promise<{ data: NotificationRow[]; error: NotificationError | null }> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, sender_id, type, title, reason, content, is_admin_origin, is_read, created_at")
    .or(`recipient_id.eq.${userId},recipient_id.is.null`)
    .eq("is_admin_origin", adminOrigin)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    return {
      data: [],
      error: {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
      },
    }
  }
  const normalizedRows = ((data ?? []) as Array<Partial<NotificationRow>>).map((row) => ({
    id: String(row.id ?? ""),
    recipient_id: row.recipient_id ?? null,
    sender_id: row.sender_id ?? null,
    type: String(row.type ?? ""),
    title: row.title ?? null,
    reason: row.reason ?? null,
    content: row.content ?? null,
    is_admin_origin: row.is_admin_origin === true,
    is_read: row.is_read === true,
    created_at: String(row.created_at ?? ""),
  }))
  return { data: normalizedRows, error: null }
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false)
  if (error || count == null) {
    return 0
  }
  return Math.max(0, Math.floor(Number(count)))
}

export async function markNotificationAsRead(
  supabase: SupabaseClient,
  notificationId: string,
): Promise<{ error: NotificationError | null }> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
  if (error) {
    return {
      error: {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
      },
    }
  }
  return { error: null }
}

export async function createAdminOriginNotification(
  supabase: SupabaseClient,
  params: {
    recipient_id: string
    type: string
    content: string
  },
): Promise<{ error: NotificationError | null }> {
  const { error } = await supabase.rpc("create_admin_notification", {
    p_recipient_id: params.recipient_id,
    p_type: params.type,
    p_content: params.content,
  })
  if (error) {
    return {
      error: {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
      },
    }
  }
  return { error: null }
}

export async function createGeneralNotification(
  supabase: SupabaseClient,
  params: {
    recipient_id: string
    sender_id: string
    type: string
    content: string
    title?: string | null
    reason?: string | null
  },
): Promise<{ error: NotificationError | null }> {
  const { error } = await supabase.from("notifications").insert({
    recipient_id: params.recipient_id,
    sender_id: params.sender_id,
    type: params.type,
    title: params.title ?? null,
    reason: params.reason ?? null,
    content: params.content,
    is_admin_origin: false,
    is_read: false,
  })

  if (error) {
    console.error("[createGeneralNotification] notifications.insert failed", {
      message: error.message,
      code: (error as { code?: string }).code ?? null,
      details: (error as { details?: string }).details ?? null,
      hint: (error as { hint?: string }).hint ?? null,
      payload: {
        recipient_id: params.recipient_id,
        sender_id: params.sender_id,
        type: params.type,
        has_content: params.content.trim().length > 0,
      },
    })
    return {
      error: {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
      },
    }
  }

  return { error: null }
}

export async function sendAdminNotification(
  supabase: SupabaseClient,
  params: CreateAnnouncementParams,
): Promise<{ error: NotificationError | null }> {
  const p_target_user_id = parseRpcTargetUserId(params.target_user_id)
  const p_reason = parseRpcReason(params.reason)
  const rpcArgs: CreateAnnouncementRpcPayload = {
    p_title: params.title,
    p_reason,
    p_content: params.content,
  }
  if (p_target_user_id != null) {
    rpcArgs.p_target_user_id = p_target_user_id
  }
  const response = await supabase.rpc("send_admin_notification", rpcArgs)
  const status = (response as { status?: number }).status ?? null
  const statusText = (response as { statusText?: string }).statusText ?? null
  const { error } = response
  if (error) {
    logRpcFailure("sendAdminNotification", {
      error,
      status,
      statusText,
      rpcName: "send_admin_notification",
      args: rpcArgs,
    })
    return {
      error: {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
        status,
        statusText,
      },
    }
  }
  return { error: null }
}
