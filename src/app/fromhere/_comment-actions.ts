"use server"

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"

import { requireActionUser } from "@/lib/supabase/action-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getBanStatusFromProfile } from "@/lib/ban"
import { sendUserEventEmail } from "@/lib/event-email"

import {
  FROMHERE_UUID_REGEX,
  validateFromHereCommentInput,
  type FromHereCommentErrorKey,
} from "@/fromhere/_comment-validation"

/** ----------------------------------------------------------
 *  FromHere コメント Server Actions
 *
 *  Route Handler (`app/api/fromhere/comments/route.ts`) ではなく
 *  Server Action として実装している理由:
 *
 *  - 本プロジェクトの開発環境では Next.js のファイルシステムルーター
 *    (`app/**\/route.ts` のスキャン) が新規 route.ts ファイルを取り
 *    込まないという問題が継続的に発生していた。
 *  - Server Action はクライアントコンポーネントの import グラフから
 *    辿られて bundle されるため、ファイルシステムルーターを経由せず
 *    確実に呼び出せる。
 *
 *  クライアント (`_CommentsSection.tsx`) はこのモジュールから
 *  関数を直接 import して `await submitFromHereCommentAction(...)` の
 *  ように呼ぶ。Next.js が内部的に POST を発行し RSC 経由で実行する。
 * ---------------------------------------------------------- */

export type FromHereCommentActionError =
  | "internal"
  | "rate_limited"
  | "not_found"
  | "product_not_found"
  | "needs_profile"
  | "forbidden"
  | "invalid_id"
  | "unauthorized"
  /** BAN 中のユーザーがコメント投稿/削除をしようとした */
  | "banned"
  | FromHereCommentErrorKey

export type SubmittedComment = {
  id: string
  body: string
  created_at: string
  parent_id: string | null
  user_id: string
}

export type SubmitFromHereCommentResult =
  | { ok: true; comment: SubmittedComment }
  | { ok: false; error: FromHereCommentActionError }

export type DeleteFromHereCommentResult =
  | { ok: true; deleted: true }
  | { ok: false; error: FromHereCommentActionError }

/** ----------------------------------------------------------
 *  メモリ内レートリミッタ
 *
 *  Server Action は同一プロセスで実行されるためグローバル Map で
 *  簡易的に制限する。デプロイ単位を跨いだ厳密な制限が必要になった
 *  場合は Redis / Supabase 等の永続ストアに移行する想定。
 * ---------------------------------------------------------- */
type Limit = { windowMs: number; max: number }
type RateBucket = Map<string, { count: number; resetAt: number }>

const POST_LIMITS: Limit[] = [
  { windowMs: 30_000, max: 5 },
  { windowMs: 60 * 60_000, max: 60 },
]
const DELETE_LIMITS: Limit[] = [{ windowMs: 60_000, max: 30 }]
const postBuckets: RateBucket[] = POST_LIMITS.map(() => new Map())
const deleteBuckets: RateBucket[] = DELETE_LIMITS.map(() => new Map())

/** BAN されているユーザーの書き込み操作を一律で拒否するためのガード。
 *  本体 `profiles.status = 'banned'` または `is_banned = true` を BAN とみなす。 */
async function isUserBanned(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { isBanned } = await getBanStatusFromProfile(supabase, userId)
    return isBanned
  } catch {
    return false
  }
}

function consumeRate(buckets: RateBucket[], limits: Limit[], userId: string): boolean {
  const now = Date.now()
  for (let i = 0; i < limits.length; i++) {
    const entry = buckets[i]!.get(userId)
    if (entry && entry.resetAt > now && entry.count >= limits[i]!.max) {
      return false
    }
  }
  for (let i = 0; i < limits.length; i++) {
    const { windowMs } = limits[i]!
    const store = buckets[i]!
    const entry = store.get(userId)
    if (!entry || entry.resetAt <= now) {
      store.set(userId, { count: 1, resetAt: now + windowMs })
    } else {
      entry.count += 1
    }
  }
  return true
}

/** ----------------------------------------------------------
 *  投稿
 * ---------------------------------------------------------- */
export async function submitFromHereCommentAction(input: {
  body: unknown
  productId: unknown
}): Promise<SubmitFromHereCommentResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (await isUserBanned(auth.session.supabase, userId)) {
      return { ok: false, error: "banned" }
    }

    if (!consumeRate(postBuckets, POST_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const validation = validateFromHereCommentInput({
      body: input.body,
      productId: input.productId,
    })
    if (!validation.ok) {
      return { ok: false, error: validation.error }
    }
    const { body: commentBody, productId } = validation.value

    const adminClient = getSupabaseAdminClient()
    const dataClient = adminClient ?? auth.session.supabase

    const { data: profile, error: profileError } = await dataClient
      .from("newvibes_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle()
    if (profileError) {
      console.error("[fromhere/comments submit] profile lookup failed", profileError)
      return { ok: false, error: "internal" }
    }
    if (!profile) {
      return { ok: false, error: "needs_profile" }
    }

    const { data: product, error: productError } = await dataClient
      .from("newvibes_products")
      .select("id, slug, title, status, maker_id, admin_hidden_at")
      .eq("id", productId)
      .maybeSingle()
    if (productError) {
      console.error("[fromhere/comments submit] product lookup failed", productError)
      return { ok: false, error: "internal" }
    }
    if (!product) {
      return { ok: false, error: "product_not_found" }
    }
    const isOwn = product.maker_id === userId
    if (product.status !== "published" && !isOwn) {
      return { ok: false, error: "product_not_found" }
    }
    /** 運営が非公開化中のプロダクトには、誰もコメントできない（オーナーも含む）。 */
    if (product.admin_hidden_at != null) {
      return { ok: false, error: "product_not_found" }
    }

    const { data: inserted, error: insertError } = await dataClient
      .from("newvibes_comments")
      .insert({
        product_id: productId,
        user_id: userId,
        body: commentBody,
      })
      .select("id, body, created_at, parent_id, user_id")
      .single()
    if (insertError || !inserted) {
      console.error("[fromhere/comments submit] insert failed", insertError)
      return { ok: false, error: "internal" }
    }

    if (adminClient) {
      const { error: recountError } = await adminClient.rpc(
        "newvibes_recount_product_comments",
        { p_product_id: productId },
      )
      if (recountError) {
        const { count } = await adminClient
          .from("newvibes_comments")
          .select("id", { count: "exact", head: true })
          .eq("product_id", productId)
        if (typeof count === "number") {
          await adminClient
            .from("newvibes_products")
            .update({ comment_count: count })
            .eq("id", productId)
        }
      }
    }

    /**
     * メーカー（投稿者）宛にメール通知を送る。
     * - 自分自身のコメント (`isOwn`) のときは送らない。
     * - `after()` を使ってレスポンス返却後に走らせるため、メール送信のレイテンシや失敗が
     *   コメント投稿レスポンスに影響することは無い。
     * - `notifyMakerOfNewComment` は内部で完全に try/catch しているので throw しない。
     * - 受信側のメール通知設定 (`fromhere_comment`) で OFF にされていれば
     *   `sendUserEventEmail` 内部で送信スキップされる。
     */
    if (!isOwn) {
      const notifyParams = {
        recipientUserId: product.maker_id as string,
        productSlug: (product.slug as string) ?? "",
        productTitle: (product.title as string) ?? "",
        commenterUserId: userId,
        commentBody,
      }
      after(async () => {
        await notifyMakerOfNewComment(notifyParams)
      })
    }

    return {
      ok: true,
      comment: {
        id: inserted.id as string,
        body: inserted.body as string,
        created_at: inserted.created_at as string,
        parent_id: (inserted.parent_id as string | null) ?? null,
        user_id: inserted.user_id as string,
      },
    }
  } catch (error) {
    console.error("[fromhere/comments submit] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  メーカー宛コメント通知メール
 *
 *  - サイト全体の `sendUserEventEmail` を経由するため、
 *    `profiles.email_notification_settings.fromhere_comment` が OFF のときは送信されない。
 *  - 送信元/署名/フッタは既存のテンプレに準拠（多言語対応）。
 *  - コメント本文は最大 240 文字で truncate して引用する（メール本文の肥大防止）。
 *
 *  **重要**: この関数は best-effort で、絶対に例外を投げない。
 *  ・コメント投稿の本処理 (`submitFromHereCommentAction`) が `after()` でこの関数を呼ぶため
 *    例外を投げてしまうとサーバーログに混乱が出る上、運用上は何もユーザーに価値を提供できない。
 *  ・代わりに console.error でログだけ残し、サイレントに継続する。
 * ---------------------------------------------------------- */
const COMMENT_PREVIEW_MAX = 240

async function notifyMakerOfNewComment(params: {
  recipientUserId: string
  productSlug: string
  productTitle: string
  commenterUserId: string
  commentBody: string
}): Promise<void> {
  try {
    const adminClient = getSupabaseAdminClient()
    let commenterDisplayName = "ユーザー"
    let commenterHandle: string | null = null
    if (adminClient) {
      try {
        const { data: commenterProfile } = await adminClient
          .from("newvibes_profiles")
          .select("handle, display_name")
          .eq("id", params.commenterUserId)
          .maybeSingle<{ handle: string | null; display_name: string | null }>()
        if (commenterProfile) {
          if (
            typeof commenterProfile.display_name === "string" &&
            commenterProfile.display_name.trim().length > 0
          ) {
            commenterDisplayName = commenterProfile.display_name.trim()
          }
          commenterHandle = (commenterProfile.handle ?? "").trim() || null
        }
      } catch (lookupError) {
        // プロフィール取得失敗時はフォールバックで「ユーザー」を使い、メール送信は継続する。
        console.error(
          "[fromhere/comments submit] commenter profile lookup failed",
          lookupError,
        )
      }
    }

    const preview = truncateForPreview(params.commentBody, COMMENT_PREVIEW_MAX)
    const productTitle = params.productTitle || "あなたの投稿"
    const commenterLabel = commenterHandle
      ? `${commenterDisplayName} (@${commenterHandle})`
      : commenterDisplayName

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://gritvib.com").replace(/\/$/, "")
    const ctaUrl = params.productSlug
      ? `${siteUrl}/fromhere/p/${params.productSlug}`
      : `${siteUrl}/fromhere`

    await sendUserEventEmail({
      userId: params.recipientUserId,
      topic: "fromhere_comment",
      subject: `[FromHere] ${commenterLabel} さんが「${productTitle}」にコメントしました`,
      heading: "FromHere に新しいコメントが届きました",
      intro: `あなたの投稿「${productTitle}」に ${commenterLabel} さんからコメントが付きました。`,
      lines: [`「${preview}」`],
      ctaLabel: "コメントを確認する",
      ctaUrl,
      localizedKeys: {
        subjectKey: "email.fromhereComment.subject",
        headingKey: "email.fromhereComment.heading",
        introKey: "email.fromhereComment.intro",
        lineKeys: ["email.fromhereComment.line"],
        ctaLabelKey: "email.fromhereComment.ctaLabel",
        values: {
          commenter: commenterLabel,
          productTitle,
          preview,
        },
      },
    })
  } catch (emailError) {
    // Resend のレートリミットや SMTP エラー、ネットワーク障害など全ての異常を握りつぶす。
    // メール通知は best-effort の付随機能で、本処理（コメント投稿）の挙動には絶対に影響させない。
    console.error("[fromhere/comments submit] email notify failed", emailError)
  }
}

/** メール本文プレビュー用のテキスト整形。改行は 1 つにまとめ、長すぎる本文は `…` で省略する。 */
function truncateForPreview(raw: string, maxLength: number): string {
  const normalized = raw.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength)}…`
}

/** ----------------------------------------------------------
 *  削除
 * ---------------------------------------------------------- */
export async function deleteFromHereCommentAction(input: {
  commentId: unknown
}): Promise<DeleteFromHereCommentResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (await isUserBanned(auth.session.supabase, userId)) {
      return { ok: false, error: "banned" }
    }

    if (!consumeRate(deleteBuckets, DELETE_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const commentId = typeof input.commentId === "string" ? input.commentId.trim() : ""
    if (!FROMHERE_UUID_REGEX.test(commentId)) {
      return { ok: false, error: "invalid_id" }
    }

    const adminClient = getSupabaseAdminClient()
    const dataClient = adminClient ?? auth.session.supabase

    const { data: existing, error: existingError } = await dataClient
      .from("newvibes_comments")
      .select("id, user_id, product_id")
      .eq("id", commentId)
      .maybeSingle()
    if (existingError) {
      console.error("[fromhere/comments delete] lookup failed", existingError)
      return { ok: false, error: "internal" }
    }
    if (!existing) {
      return { ok: false, error: "not_found" }
    }
    if (existing.user_id !== userId) {
      return { ok: false, error: "forbidden" }
    }

    const { error: deleteError } = await dataClient
      .from("newvibes_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", userId)
    if (deleteError) {
      console.error("[fromhere/comments delete] delete failed", deleteError)
      return { ok: false, error: "internal" }
    }

    const productId = existing.product_id as string | null
    if (adminClient && productId) {
      const { error: recountError } = await adminClient.rpc(
        "newvibes_recount_product_comments",
        { p_product_id: productId },
      )
      if (recountError) {
        const { count } = await adminClient
          .from("newvibes_comments")
          .select("id", { count: "exact", head: true })
          .eq("product_id", productId)
        if (typeof count === "number") {
          await adminClient
            .from("newvibes_products")
            .update({ comment_count: count })
            .eq("id", productId)
        }
      }
    }

    return { ok: true, deleted: true }
  } catch (error) {
    console.error("[fromhere/comments delete] unexpected", error)
    return { ok: false, error: "internal" }
  }
}
