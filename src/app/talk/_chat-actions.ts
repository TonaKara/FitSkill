"use server"

import "server-only"

import Stripe from "stripe"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireActionUser } from "@/lib/supabase/action-auth"
import {
  mapGritvibChatMessageRow,
  type GritvibChatMessage,
} from "@/lib/talk/gritvib-chat-message"
import { resolveGritvibSubscriptionPeriodEndIso } from "@/lib/talk/stripe-subscription-period"
import type { GritvibSubscriptionCapacityStatus } from "@/lib/talk/gritvib-subscription-capacity"
import { loadGritvibMemberSubscriptionCapacityStatus } from "@/lib/talk/gritvib-subscription-capacity-store"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

/**
 * GritVib (人間チャットサービス) のチャット関連 Server Actions。
 *
 * 提供する操作:
 *   - `sendGritvibChatMessageAction`: テキスト or 画像メッセージを自分のスレッドに送る。
 *   - `deleteGritvibChatMessageAction`: 自分が送ったメッセージを物理削除する。
 *   - `hideGritvibChatMessageAction`: 相手のメッセージを自分の画面からだけ非表示にする。
 *   - `getGritvibChatSendabilityAction`: 自分が今メッセージ送信できるかを返す。
 *
 * 画像のアップロード自体はクライアント側で `supabase.storage` から直接行い、その path だけを
 * `sendGritvibChatMessageAction` に渡す方式。これにより multipart を経由せず、RLS だけで
 * パス制約 (`{auth.uid()}/...`) を保証できる。
 *
 * Realtime 経由で配信されるので、クライアント側の楽観 UI ではなく DB 反映後に表示する設計。
 */

const MESSAGE_BODY_MAX_LENGTH = 2000

type SendMessageResult =
  | { ok: true; message: GritvibChatMessage }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "subscription_required"
        | "empty_payload"
        | "body_too_long"
        | "invalid_image_path"
        | "internal"
    }

type DeleteMessageResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "not_found" | "forbidden" | "internal" }

type HideMessageResult =
  | { ok: true }
  | {
      ok: false
      reason: "unauthenticated" | "not_found" | "forbidden" | "already_hidden" | "internal"
    }

type SendabilityResult =
  | { ok: true; canSend: boolean }
  | { ok: false; reason: "unauthenticated" | "internal" }

type SubscriptionCapacityResult =
  | { ok: true; status: GritvibSubscriptionCapacityStatus }
  | { ok: false; reason: "unauthenticated" | "internal" }

export async function sendGritvibChatMessageAction(input: {
  body?: string | null
  imagePath?: string | null
}): Promise<SendMessageResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase, user } = sessionResult.session

  const trimmedBody = (input.body ?? "").trim()
  const trimmedImagePath = (input.imagePath ?? "").trim()

  if (trimmedBody.length === 0 && trimmedImagePath.length === 0) {
    return { ok: false, reason: "empty_payload" }
  }
  if (trimmedBody.length > MESSAGE_BODY_MAX_LENGTH) {
    return { ok: false, reason: "body_too_long" }
  }
  /**
   * 画像 path は `{auth.uid()}/...` の形に限定する。
   * Storage の RLS でも保証されるが、サーバー側でも先に弾いて DB に保存される path を制御する。
   */
  if (trimmedImagePath.length > 0) {
    const expectedPrefix = `${user.id}/`
    if (!trimmedImagePath.startsWith(expectedPrefix)) {
      return { ok: false, reason: "invalid_image_path" }
    }
  }

  /** サブスク状態の事前確認 (RLS 側でも担保されるが、UX のために専用エラーを返したい)。 */
  const { data: canSend, error: canSendError } = await supabase.rpc(
    "gritvib_chat_member_can_send",
    { p_member_id: user.id },
  )
  if (canSendError) {
    logTalkServerError("[talk/chat] sendability rpc error")
    return { ok: false, reason: "internal" }
  }
  if (canSend !== true) {
    return { ok: false, reason: "subscription_required" }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("gritvib_chat_messages")
    .insert({
      thread_member_id: user.id,
      sender_role: "member",
      sender_user_id: user.id,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      image_path: trimmedImagePath.length > 0 ? trimmedImagePath : null,
    })
    .select(
      "id, thread_member_id, sender_role, sender_user_id, body, image_path, created_at",
    )
    .single()

  if (insertError || !inserted) {
    logTalkServerError("[talk/chat] insert message failed")
    return { ok: false, reason: "internal" }
  }

  return { ok: true, message: mapGritvibChatMessageRow(inserted) }
}

export async function deleteGritvibChatMessageAction(
  messageId: string,
): Promise<DeleteMessageResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase, user } = sessionResult.session

  const trimmedId = messageId.trim()
  if (!trimmedId) {
    return { ok: false, reason: "not_found" }
  }

  /** 削除対象の path を取り出してから DELETE する。画像があれば物理削除でストレージも掃除。 */
  const { data: target, error: targetError } = await supabase
    .from("gritvib_chat_messages")
    .select("id, thread_member_id, sender_user_id, image_path")
    .eq("id", trimmedId)
    .eq("thread_member_id", user.id)
    .maybeSingle()

  if (targetError) {
    logTalkServerError("[talk/chat] read message failed")
    return { ok: false, reason: "internal" }
  }
  if (!target) {
    return { ok: false, reason: "not_found" }
  }
  if (target.sender_user_id !== user.id) {
    return { ok: false, reason: "forbidden" }
  }

  const { error: deleteError } = await supabase
    .from("gritvib_chat_messages")
    .delete()
    .eq("id", trimmedId)
    .eq("thread_member_id", user.id)

  if (deleteError) {
    logTalkServerError("[talk/chat] delete message failed")
    return { ok: false, reason: "internal" }
  }

  if (target.image_path) {
    const { error: storageError } = await supabase.storage
      .from("gritvib-chat-photos")
      .remove([target.image_path])
    if (storageError) {
      // 画像の物理削除に失敗しても、メッセージ本体の DELETE は完了しているので致命視しない。
      logTalkServerError("[talk/chat] storage remove failed")
    }
  }

  return { ok: true }
}

export async function hideGritvibChatMessageAction(
  messageId: string,
): Promise<HideMessageResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase, user } = sessionResult.session

  const trimmedId = messageId.trim()
  if (!trimmedId) {
    return { ok: false, reason: "not_found" }
  }

  const { data: target, error: targetError } = await supabase
    .from("gritvib_chat_messages")
    .select("id, thread_member_id, sender_user_id")
    .eq("id", trimmedId)
    .eq("thread_member_id", user.id)
    .maybeSingle()

  if (targetError) {
    logTalkServerError("[talk/chat] read message for hide failed")
    return { ok: false, reason: "internal" }
  }
  if (!target) {
    return { ok: false, reason: "not_found" }
  }
  if (target.sender_user_id === user.id) {
    return { ok: false, reason: "forbidden" }
  }

  const { error: insertError } = await supabase.from("gritvib_chat_message_hides").insert({
    user_id: user.id,
    message_id: trimmedId,
  })

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, reason: "already_hidden" }
    }
    logTalkServerError("[talk/chat] hide message failed")
    return { ok: false, reason: "internal" }
  }

  return { ok: true }
}

export async function getGritvibChatSendabilityAction(): Promise<SendabilityResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase, user } = sessionResult.session

  const { data, error } = await supabase.rpc("gritvib_chat_member_can_send", {
    p_member_id: user.id,
  })
  if (error) {
    logTalkServerError("[talk/chat] sendability rpc error")
    return { ok: false, reason: "internal" }
  }
  return { ok: true, canSend: data === true }
}

/** 新規サブスク受付枠（満員時は UI で「有効にする」を無効化するだけ）。 */
export async function getGritvibSubscriptionCapacityStatusAction(): Promise<SubscriptionCapacityResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase } = sessionResult.session

  try {
    const status = await loadGritvibMemberSubscriptionCapacityStatus(supabase)
    return { ok: true, status }
  } catch (err) {
    logTalkServerError("[talk/chat] subscription capacity load failed", err)
    return { ok: false, reason: "internal" }
  }
}

/**
 * Webhook が届いていない場合に備えた手動リカバリー。
 *
 *   1. 認証済みユーザーの email で Stripe Customer を検索
 *   2. その Customer の `active` / `trialing` な Subscription を 1 件取得
 *   3. 見つかれば `gritvib_chat_members` を更新（status / current_period_end / stripe_customer_id）
 *
 * 用途:
 *   - チャット初回ロードで `canSend=false` のとき、Webhook 漏れをサーバー側で静かに同期する
 *   - Checkout 直後 (`?sub=ok`) の polling 後にも呼ばれる
 *
 * 設計判断:
 *   - 一般ユーザー向け UI には出さない (失敗理由はログのみ)
 *   - 結果は冪等。複数回呼んでも問題なし
 */
type RecoverSubscriptionResult =
  | { ok: true; canSend: boolean }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "stripe_not_configured"
        | "no_email"
        | "not_onboarded"
        | "no_subscription"
        | "subscription_inactive"
        | "internal"
    }

export async function recoverGritvibSubscriptionFromStripeAction(): Promise<RecoverSubscriptionResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { user } = sessionResult.session
  const email = user.email?.trim().toLowerCase() ?? ""
  if (!email) {
    return { ok: false, reason: "no_email" }
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecret) {
    logTalkServerError("[talk/recovery] STRIPE_SECRET_KEY missing")
    return { ok: false, reason: "stripe_not_configured" }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    logTalkServerError("[talk/recovery] supabase admin client missing")
    return { ok: false, reason: "internal" }
  }

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from("gritvib_chat_members")
    .select("nickname, subscription_status")
    .eq("id", user.id)
    .maybeSingle()

  if (memberError) {
    logTalkServerError("[talk/recovery] fetch chat_members failed")
    return { ok: false, reason: "internal" }
  }
  if (!memberRow?.nickname) {
    return { ok: false, reason: "not_onboarded" }
  }

  const stripe = new Stripe(stripeSecret)

  try {
    /**
     * email で Customer を絞り込み (Stripe では email で複数 Customer が作られることがある)。
     * 各 Customer の Subscription を見て、active / trialing が最初に見つかったものを採用する。
     */
    const customers = await stripe.customers.list({ email, limit: 5 })
    let resolved: { customerId: string; subscription: Stripe.Subscription } | null = null

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      })
      for (const subscription of subscriptions.data) {
        if (subscription.status === "active" || subscription.status === "trialing") {
          resolved = { customerId: customer.id, subscription }
          break
        }
      }
      if (resolved) break
    }

    if (!resolved) {
      return { ok: false, reason: "no_subscription" }
    }

    let currentPeriodEndIso = resolveGritvibSubscriptionPeriodEndIso(resolved.subscription)

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("gritvib_chat_members")
      .update({
        subscription_status: resolved.subscription.status,
        subscription_current_period_end: currentPeriodEndIso,
        stripe_customer_id: resolved.customerId,
      })
      .eq("id", user.id)
      .select("subscription_status, subscription_current_period_end")

    if (updateError) {
      logTalkServerError("[talk/recovery] update chat_members failed")
      return { ok: false, reason: "internal" }
    }
    if (!updatedRows?.length) {
      return { ok: false, reason: "not_onboarded" }
    }

    let updated = updatedRows[0]
    const isActiveStatus =
      updated.subscription_status === "active" ||
      updated.subscription_status === "trialing"
    if (
      isActiveStatus &&
      updated.subscription_current_period_end &&
      new Date(updated.subscription_current_period_end).getTime() <= Date.now()
    ) {
      const { data: clearedRows, error: clearError } = await supabaseAdmin
        .from("gritvib_chat_members")
        .update({ subscription_current_period_end: null })
        .eq("id", user.id)
        .select("subscription_status, subscription_current_period_end")
      if (!clearError && clearedRows?.[0]) {
        updated = clearedRows[0]
        currentPeriodEndIso = null
      }
    }

    const canSend =
      isActiveStatus &&
      (updated.subscription_current_period_end == null ||
        new Date(updated.subscription_current_period_end).getTime() > Date.now())

    logTalkServerError("[talk/recovery] recovered subscription from stripe")

    if (!canSend) {
      return { ok: false, reason: "subscription_inactive" }
    }

    return { ok: true, canSend: true }
  } catch (err) {
    logTalkServerError("[talk/recovery] stripe lookup failed")
    return { ok: false, reason: "internal" }
  }
}
