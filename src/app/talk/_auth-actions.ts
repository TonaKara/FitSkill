"use server"

import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireActionUser } from "@/lib/supabase/action-auth"
import {
  validateGritvibNickname,
  type GritvibNicknameInvalidReason,
} from "@/lib/talk/nickname-rules"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

/**
 * GritVib (人間チャットサービス) の認証関連 Server Actions。
 *
 * 提供する操作:
 *   - `checkGritvibNicknameAvailabilityAction`: onboard 画面での事前重複チェック。
 *     最終的な一意性は DB の unique index で担保するため、ここはあくまでも UX のための先読み。
 *   - `completeGritvibOnboardingAction`: 初回ログイン後の onboard で `gritvib_chat_members`
 *     レコードを作成する。本人のセッション (Cookie) が必要。
 *
 * いずれもサーバー側で再バリデーションを行う。クライアント側のチェックは UX 用、信頼境界はここ。
 */

type CheckNicknameResult =
  | { ok: true; available: boolean }
  | { ok: false; reason: GritvibNicknameInvalidReason | "internal" }

type CompleteOnboardingResult =
  | { ok: true; nickname: string }
  | {
      ok: false
      reason:
        | "unauthenticated"
        | "already_onboarded"
        | "nickname_taken"
        | GritvibNicknameInvalidReason
        | "internal"
    }

export async function checkGritvibNicknameAvailabilityAction(
  rawNickname: string,
): Promise<CheckNicknameResult> {
  const validation = validateGritvibNickname(rawNickname)
  if (!validation.ok) {
    return { ok: false, reason: validation.reason }
  }
  /**
   * 重複確認は public schema の SECURITY DEFINER 関数を使い、ログイン前でも実行可能にしている。
   * 直接テーブルにアクセスすると RLS のため未ログイン状態では何も返らないため、関数経由にした。
   */
  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    logTalkServerError("[talk/auth] admin client unavailable")
    return { ok: false, reason: "internal" }
  }
  const { data, error } = await supabaseAdmin.rpc(
    "gritvib_chat_members_is_nickname_taken",
    { p_nickname: validation.value },
  )
  if (error) {
    logTalkServerError("[talk/auth] nickname check rpc error", error)
    return { ok: false, reason: "internal" }
  }
  return { ok: true, available: data !== true }
}

export async function completeGritvibOnboardingAction(
  rawNickname: string,
): Promise<CompleteOnboardingResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { user, supabase } = sessionResult.session

  const validation = validateGritvibNickname(rawNickname)
  if (!validation.ok) {
    return { ok: false, reason: validation.reason }
  }

  /** 既に onboard 済みなら何もせず、その事実を返す。冪等性のため。 */
  const { data: existingRows, error: existingError } = await supabase.rpc(
    "gritvib_chat_self_member_profile",
  )
  if (existingError) {
    logTalkServerError("[talk/auth] read self member profile failed", existingError)
    return { ok: false, reason: "internal" }
  }
  const existing = Array.isArray(existingRows) ? existingRows[0] : null
  if (existing) {
    return { ok: false, reason: "already_onboarded" }
  }

  /** 念のため重複確認（DB の unique でも担保されるが、利用者に分かりやすいエラーを返したい）。 */
  const supabaseAdmin = getSupabaseAdminClient()
  if (supabaseAdmin) {
    const { data: taken, error: takenError } = await supabaseAdmin.rpc(
      "gritvib_chat_members_is_nickname_taken",
      { p_nickname: validation.value },
    )
    if (takenError) {
      logTalkServerError("[talk/auth] nickname pre-check rpc error", takenError)
    } else if (taken === true) {
      return { ok: false, reason: "nickname_taken" }
    }
  }

  const { error: insertError } = await supabase.from("gritvib_chat_members").insert({
    id: user.id,
    nickname: validation.value,
  })

  if (insertError) {
    /**
     * unique index 違反 (23505) はニックネーム衝突として返す。
     * Postgres エラーコードは Supabase 経由でも `code` フィールドに入ってくる。
     */
    const pgErrorCode = (insertError as { code?: string }).code
    if (pgErrorCode === "23505") {
      return { ok: false, reason: "nickname_taken" }
    }
    logTalkServerError("[talk/auth] insert chat_members failed", insertError)
    return { ok: false, reason: "internal" }
  }

  return { ok: true, nickname: validation.value }
}
