"use server"

import "server-only"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireActionUser } from "@/lib/supabase/action-auth"
import { requireActionAdmin } from "@/lib/supabase/action-admin"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getBanStatusFromProfile } from "@/lib/ban"
import {
  buildBaseSlug,
  buildRandomFallbackSlug,
  buildSlugWithSuffix,
  FROMHERE_SLUG_REGEX,
} from "@/fromhere/_slug"
import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
  parseFromHereScheduledDateToUtcIso,
  validateFromHereProductDraft,
  type FromHereProductDraft,
  type FromHereProductInputErrorKey,
  type FromHereProductSanitized,
} from "@/fromhere/_product-validation"
import { validateFromHereCommentBody } from "@/fromhere/_comment-validation"

/** ----------------------------------------------------------
 *  FromHere プロダクト管理 Server Actions
 *
 *  Route Handler (`app/api/fromhere/products/[id]/route.ts`) ではなく
 *  Server Action として実装している理由は `_comment-actions.ts` と同じ。
 *  本プロジェクトの開発環境では `app/api/**\/route.ts` のファイル
 *  システムルーターが新規・既存ルートを取りこぼす不具合があり、
 *  Server Action（client component の import グラフ経由で bundle される）
 *  に切り替えることで確実に呼び出せるようにする。
 *
 *  クライアント:
 *    - `MyProductsPageClient.tsx` (status 変更 / 削除)
 *    - `EditProductPageClient.tsx`  (content 編集)
 * ---------------------------------------------------------- */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * FromHere 配下のサーバーキャッシュをまとめて無効化するヘルパ。
 *
 * - クライアントから `router.refresh()` を呼ぶより `revalidatePath` の方が大幅に高速
 *   （余分な RSC fetch を抑え、対象ルートだけを次回アクセス時に再生成する）。
 * - 個別ページ (`/fromhere/p/[slug]`, `/fromhere/u/[handle]` 等) のキャッシュは
 *   呼び出し側で必要に応じて追加で `revalidatePath` する。
 * - `try/catch` で包んで失敗を握りつぶし、Action 自体の成功は阻害しない
 *   （単一のキャッシュ無効化失敗で投稿そのものが中断されると UX が悪い）。
 */
function safeRevalidate(...paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.warn("[fromhere/revalidate] failed", { path, error })
    }
  }
}

const ALLOWED_STATUSES = ["draft", "published", "archived"] as const
export type FromHereProductStatus = (typeof ALLOWED_STATUSES)[number]

function isAllowedStatus(value: unknown): value is FromHereProductStatus {
  return typeof value === "string" && (ALLOWED_STATUSES as readonly string[]).includes(value)
}

export type FromHereProductActionError =
  | "internal"
  | "rate_limited"
  | "not_found"
  | "forbidden"
  | "invalid_id"
  | "invalid_status"
  | "invalid_payload"
  | "no_change"
  | "unauthorized"
  | "duplicate"
  | "profile_missing"
  | "slug"
  | "firstComment"
  | "firstCommentTooLong"
  /** 運営が非公開化中のため、ユーザー側からの status 変更不可 */
  | "admin_hidden"
  /** BAN 中のユーザーが投稿/編集操作をしようとした */
  | "banned"
  /** 既に公開済み（`posted_at <= now()`）のプロダクトは公開日を変更できない */
  | "schedule_locked"
  | FromHereProductInputErrorKey

export type CreateFromHereProductResult =
  | { ok: true; product: { id: string; slug: string } }
  | { ok: false; error: FromHereProductActionError }

export type FromHereProductSummary = {
  id: string
  slug: string
  status: FromHereProductStatus
}

export type UpdateFromHereProductResult =
  | { ok: true; product: FromHereProductSummary }
  | { ok: false; error: FromHereProductActionError }

export type DeleteFromHereProductResult =
  | { ok: true; deleted: true }
  | { ok: false; error: FromHereProductActionError }

/** ----------------------------------------------------------
 *  レートリミット
 *  - PATCH: 60s / 20 回、3600s / 200 回
 *  - DELETE: 60s / 5 回、3600s / 30 回
 *
 *  dev / test 環境では、繰り返しの動作確認で簡単に詰まらないように
 *  上限を大きく緩めている。本番 (`NODE_ENV === "production"`) では
 *  従来通りの厳しめの閾値を維持する。
 * ---------------------------------------------------------- */
type Limit = { windowMs: number; max: number }
type RateBucket = Map<string, { count: number; resetAt: number }>

const IS_PRODUCTION = process.env.NODE_ENV === "production"

const PATCH_LIMITS: Limit[] = IS_PRODUCTION
  ? [
      { windowMs: 60_000, max: 20 },
      { windowMs: 60 * 60_000, max: 200 },
    ]
  : [
      { windowMs: 60_000, max: 1000 },
      { windowMs: 60 * 60_000, max: 10000 },
    ]
const DELETE_LIMITS: Limit[] = IS_PRODUCTION
  ? [
      { windowMs: 60_000, max: 5 },
      { windowMs: 60 * 60_000, max: 30 },
    ]
  : [
      { windowMs: 60_000, max: 1000 },
      { windowMs: 60 * 60_000, max: 10000 },
    ]
const CREATE_LIMITS: Limit[] = IS_PRODUCTION
  ? [
      { windowMs: 60 * 1000, max: 3 },
      { windowMs: 60 * 60 * 1000, max: 20 },
    ]
  : [
      { windowMs: 60 * 1000, max: 1000 },
      { windowMs: 60 * 60 * 1000, max: 10000 },
    ]
const patchBuckets: RateBucket[] = PATCH_LIMITS.map(() => new Map())
const deleteBuckets: RateBucket[] = DELETE_LIMITS.map(() => new Map())
const createBuckets: RateBucket[] = CREATE_LIMITS.map(() => new Map())

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

function normalizeStatus(value: unknown): FromHereProductStatus {
  if (value === "draft" || value === "archived") {
    return value
  }
  return "published"
}

/** BAN されているユーザーの書き込み操作を一律で拒否するためのガード。
 *  本体 `profiles.status = 'banned'` または `is_banned = true` を BAN とみなす。 */
async function isUserBanned(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { isBanned } = await getBanStatusFromProfile(supabase, userId)
    return isBanned
  } catch {
    // BAN チェックに失敗した場合は安全側に倒さず通常通り (false) に倒す。
    // BAN を強制したい場合は監視ログで検知する。
    return false
  }
}

/** Storage 上のオブジェクトの実在を確認する。
 *  認証済みクライアントの storage RLS で本人フォルダ配下のみ list できるという仕様を利用。
 */
async function existsStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<boolean> {
  const lastSlash = path.lastIndexOf("/")
  if (lastSlash <= 0) {
    return false
  }
  const folder = path.slice(0, lastSlash)
  const filename = path.slice(lastSlash + 1)
  if (!folder || !filename) {
    return false
  }
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    search: filename,
    limit: 1,
  })
  if (error || !data) {
    return false
  }
  return data.some((item) => item.name === filename)
}

function generateRandomSuffix(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 6)
  }
  return Math.random().toString(36).slice(2, 8)
}

type TryInsertResult = "ok" | "conflict" | "duplicate_url" | "error"

async function tryInsertProductWithSlug(
  supabase: SupabaseClient,
  params: {
    userId: string
    sanitized: FromHereProductSanitized
    slug: string
    /** JST 00:00 → UTC ISO。未指定なら DB の default (now()) に任せる（後方互換）。 */
    postedAtIso?: string
  },
): Promise<TryInsertResult> {
  const insertPayload: Record<string, unknown> = {
    slug: params.slug,
    title: params.sanitized.title,
    tagline: params.sanitized.tagline,
    description: params.sanitized.description,
    category: params.sanitized.category,
    tags: params.sanitized.tags,
    product_url: params.sanitized.productUrl,
    app_icon_path: params.sanitized.appIconPath,
    screenshot_path: params.sanitized.screenshotPath,
    maker_id: params.userId,
    status: "published",
  }
  if (params.postedAtIso) {
    insertPayload.posted_at = params.postedAtIso
  }
  const { error } = await supabase.from("newvibes_products").insert(insertPayload)
  if (!error) {
    return "ok"
  }
  const code = (error as { code?: string }).code ?? ""
  const message = error.message ?? ""
  const details = (error as { details?: string }).details ?? ""
  const hint = (error as { hint?: string }).hint ?? ""
  if (code === "23505") {
    if (message.includes("slug")) {
      console.warn("[fromhere/products insert] slug conflict, retrying", {
        slug: params.slug,
      })
      return "conflict"
    }
    if (message.includes("product_url")) {
      console.warn("[fromhere/products insert] duplicate product_url (db unique)", {
        productUrl: params.sanitized.productUrl,
      })
      return "duplicate_url"
    }
    console.warn("[fromhere/products insert] 23505 unique violation (other)", {
      code,
      message,
      details,
      hint,
    })
    return "conflict"
  }
  console.error("[fromhere/products insert] db error", {
    code,
    message,
    details,
    hint,
    slug: params.slug,
    userId: params.userId,
  })
  return "error"
}

async function insertProductWithUniqueSlug(
  supabase: SupabaseClient,
  params: {
    userId: string
    sanitized: FromHereProductSanitized
    postedAtIso?: string
  },
): Promise<
  | { ok: true; product: { id: string; slug: string } }
  | { ok: false; error: "slug" | "duplicate" | "internal" }
> {
  const base = buildBaseSlug(params.sanitized.title)

  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate =
      base.length === 0
        ? buildRandomFallbackSlug(params.sanitized.title, generateRandomSuffix)
        : buildSlugWithSuffix(base, attempt)
    if (!FROMHERE_SLUG_REGEX.test(candidate)) {
      continue
    }
    const result = await tryInsertProductWithSlug(supabase, { ...params, slug: candidate })
    if (result === "ok") {
      const { data: justInserted } = await supabase
        .from("newvibes_products")
        .select("id, slug")
        .eq("maker_id", params.userId)
        .eq("slug", candidate)
        .maybeSingle()
      if (justInserted) {
        return {
          ok: true,
          product: { id: String(justInserted.id), slug: String(justInserted.slug) },
        }
      }
      return { ok: false, error: "internal" }
    }
    if (result === "conflict") {
      continue
    }
    if (result === "duplicate_url") {
      return { ok: false, error: "duplicate" }
    }
    return { ok: false, error: "internal" }
  }

  // 50 連続失敗時のフォールバック
  const fallbackSlug = buildRandomFallbackSlug(params.sanitized.title, generateRandomSuffix)
  if (!FROMHERE_SLUG_REGEX.test(fallbackSlug)) {
    return { ok: false, error: "slug" }
  }
  const fallbackResult = await tryInsertProductWithSlug(supabase, {
    ...params,
    slug: fallbackSlug,
  })
  if (fallbackResult !== "ok") {
    return { ok: false, error: "slug" }
  }
  const { data: fallbackRow } = await supabase
    .from("newvibes_products")
    .select("id, slug")
    .eq("maker_id", params.userId)
    .eq("slug", fallbackSlug)
    .maybeSingle()
  if (!fallbackRow) {
    return { ok: false, error: "internal" }
  }
  return {
    ok: true,
    product: { id: String(fallbackRow.id), slug: String(fallbackRow.slug) },
  }
}

/** ----------------------------------------------------------
 *  新規プロダクト投稿
 *
 *  公開日（JST）を `scheduledDate` (YYYY-MM-DD) で受け取り、JST 00:00 を
 *  `posted_at` (UTC ISO) に保存する。最短は翌日。ホームの一覧クエリは
 *  `posted_at <= now()` で未来分を弾く運用。
 * ---------------------------------------------------------- */
export async function createFromHereProductAction(input: {
  title?: unknown
  tagline?: unknown
  description?: unknown
  category?: unknown
  tags?: unknown
  productUrl?: unknown
  appIconPath?: unknown
  screenshotPath?: unknown
  /** YYYY-MM-DD (JST)。最短で翌日。 */
  scheduledDate?: unknown
  /**
   * メーカー本人による「最初のコメント」(任意)。
   * - 非空の場合のみ、プロダクトと同じ公開時刻 (`posted_at`) を `created_at` に
   *   セットして `newvibes_comments` に保存する。
   * - 失敗してもプロダクト投稿自体は成功扱い（best-effort）。
   */
  firstComment?: unknown
}): Promise<CreateFromHereProductResult> {
  console.info("[fromhere/products create] action invoked", {
    hasTitle: typeof input.title === "string" && (input.title as string).length > 0,
    hasTagline: typeof input.tagline === "string" && (input.tagline as string).length > 0,
    hasProductUrl: typeof input.productUrl === "string" && (input.productUrl as string).length > 0,
    hasAppIcon: typeof input.appIconPath === "string" && (input.appIconPath as string).length > 0,
    hasScreenshot:
      typeof input.screenshotPath === "string" && (input.screenshotPath as string).length > 0,
    scheduledDate: input.scheduledDate,
    category: input.category,
    tagsCount: Array.isArray(input.tags) ? input.tags.length : 0,
    hasFirstComment:
      typeof input.firstComment === "string" && (input.firstComment as string).length > 0,
  })
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      console.warn("[fromhere/products create] unauthorized")
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (await isUserBanned(auth.session.supabase, userId)) {
      console.warn("[fromhere/products create] user banned", { userId })
      return { ok: false, error: "banned" }
    }

    if (!consumeRate(createBuckets, CREATE_LIMITS, userId)) {
      console.warn("[fromhere/products create] rate limited", { userId })
      return { ok: false, error: "rate_limited" }
    }

    const tagsArray: string[] = Array.isArray(input.tags)
      ? input.tags.filter((v): v is string => typeof v === "string").slice(0, 20)
      : []

    const draft: FromHereProductDraft = {
      title: String(input.title ?? ""),
      tagline: String(input.tagline ?? ""),
      description: String(input.description ?? ""),
      category: String(input.category ?? ""),
      tags: tagsArray,
      productUrl: String(input.productUrl ?? ""),
      appIconPath:
        typeof input.appIconPath === "string" && input.appIconPath.length > 0
          ? input.appIconPath
          : null,
      screenshotPath:
        typeof input.screenshotPath === "string" && input.screenshotPath.length > 0
          ? input.screenshotPath
          : null,
    }

    const validation = validateFromHereProductDraft(draft, {
      makerUserId: userId,
      requireAppIcon: true,
    })
    if (!validation.ok) {
      console.warn("[fromhere/products create] validation failed", {
        userId,
        error: validation.error,
        draftPreview: {
          titleLen: draft.title.length,
          taglineLen: draft.tagline.length,
          descriptionLen: draft.description.length,
          category: draft.category,
          tagsCount: draft.tags.length,
          productUrl: draft.productUrl,
          hasAppIcon: !!draft.appIconPath,
          hasScreenshot: !!draft.screenshotPath,
        },
      })
      return { ok: false, error: validation.error }
    }
    const sanitized = validation.value

    // 公開日 (JST) を検証して posted_at (UTC ISO) に変換
    const scheduled = parseFromHereScheduledDateToUtcIso(input.scheduledDate)
    if (!scheduled.ok) {
      console.warn("[fromhere/products create] scheduledDate invalid", {
        userId,
        scheduledDate: input.scheduledDate,
      })
      return { ok: false, error: "scheduledDate" }
    }
    const postedAtIso = scheduled.iso

    /**
     * 最初のコメント (任意) を事前検証する。
     * - 空文字 / undefined はスキップ扱い。
     * - 値が入っていて検証 NG ならプロダクト投稿自体を失敗にする
     *   （ユーザーに修正の機会を与えるため）。
     */
    let firstCommentBody: string | null = null
    if (typeof input.firstComment === "string" && input.firstComment.trim().length > 0) {
      const fc = validateFromHereCommentBody(input.firstComment)
      if (!fc.ok) {
        console.warn("[fromhere/products create] firstComment validation failed", {
          userId,
          error: fc.error,
        })
        return {
          ok: false,
          error: fc.error === "tooLong" ? "firstCommentTooLong" : "firstComment",
        }
      }
      firstCommentBody = fc.body
    }

    // Supabase クライアント。本人 cookie セッションのものを使う（storage RLS の所有検証も兼ねるため）
    const cookieClient = auth.session.supabase

    // メーカープロフィール存在確認
    const { data: profile, error: profileError } = await cookieClient
      .from("newvibes_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle()
    if (profileError) {
      console.error("[fromhere/products create] profile lookup failed", profileError)
      return { ok: false, error: "internal" }
    }
    if (!profile) {
      return { ok: false, error: "profile_missing" }
    }

    if (sanitized.appIconPath) {
      const exists = await existsStorageObject(
        cookieClient,
        FROMHERE_APP_ICONS_BUCKET,
        sanitized.appIconPath,
      )
      if (!exists) {
        console.warn("[fromhere/products create] appIcon storage object missing", {
          userId,
          path: sanitized.appIconPath,
        })
        return { ok: false, error: "appIcon" }
      }
    }
    if (sanitized.screenshotPath) {
      const exists = await existsStorageObject(
        cookieClient,
        FROMHERE_SCREENSHOTS_BUCKET,
        sanitized.screenshotPath,
      )
      if (!exists) {
        console.warn("[fromhere/products create] screenshot storage object missing", {
          userId,
          path: sanitized.screenshotPath,
        })
        return { ok: false, error: "screenshot" }
      }
    }

    // 同一 URL の重複投稿（同一 maker のみ）を弾く
    const { data: dup, error: dupError } = await cookieClient
      .from("newvibes_products")
      .select("id, status")
      .eq("maker_id", userId)
      .eq("product_url", sanitized.productUrl)
      .neq("status", "archived")
      .limit(1)
    if (dupError) {
      console.error("[fromhere/products create] duplicate lookup failed", dupError)
      return { ok: false, error: "internal" }
    }
    if (dup && dup.length > 0) {
      console.warn("[fromhere/products create] duplicate productUrl for maker", {
        userId,
        productUrl: sanitized.productUrl,
        existingId: dup[0]?.id,
        existingStatus: dup[0]?.status,
      })
      return { ok: false, error: "duplicate" }
    }

    const inserted = await insertProductWithUniqueSlug(cookieClient, {
      userId,
      sanitized,
      postedAtIso,
    })
    if (!inserted.ok) {
      console.error("[fromhere/products create] insertProductWithUniqueSlug failed", {
        userId,
        error: inserted.error,
      })
      return { ok: false, error: inserted.error }
    }

    /**
     * 最初のコメント (任意) をプロダクト挿入後に保存する。
     * - `created_at` を `posted_at` と同じ値に揃えるため、admin client (RLS bypass)
     *   を使って明示挿入する。RLS のままだと `created_at` は default now() に上書き
     *   されてしまうため。
     * - コメント挿入に失敗してもプロダクト投稿は成功扱いとし、エラーログだけ残す。
     */
    if (firstCommentBody) {
      const adminClient = getSupabaseAdminClient()
      if (adminClient) {
        const { error: commentError } = await adminClient
          .from("newvibes_comments")
          .insert({
            product_id: inserted.product.id,
            user_id: userId,
            body: firstCommentBody,
            created_at: postedAtIso,
          })
        if (commentError) {
          console.error(
            "[fromhere/products create] first comment insert failed",
            commentError,
          )
        } else {
          // comment_count を再計算 (DB トリガーで自動更新されている可能性もあるが、
          // 念のため明示的に揃えておく)
          const { error: recountError } = await adminClient.rpc(
            "newvibes_recount_product_comments",
            { p_product_id: inserted.product.id },
          )
          if (recountError) {
            const { count } = await adminClient
              .from("newvibes_comments")
              .select("id", { count: "exact", head: true })
              .eq("product_id", inserted.product.id)
            if (typeof count === "number") {
              await adminClient
                .from("newvibes_products")
                .update({ comment_count: count })
                .eq("id", inserted.product.id)
            }
          }
        }
      } else {
        console.warn(
          "[fromhere/products create] admin client unavailable; first comment skipped",
        )
      }
    }

    /**
     * 投稿直後にホーム / 一覧 / 自分のプロダクト一覧のキャッシュを invalidate。
     * これによりクライアント側で `router.refresh()` を呼ばなくても、リダイレクト先の
     * /fromhere は次回 fetch で最新状態になる（= リダイレクトが体感で速くなる）。
     */
    safeRevalidate(
      "/fromhere",
      "/fromhere/my/products",
      `/fromhere/p/${inserted.product.slug}`,
    )

    return { ok: true, product: inserted.product }
  } catch (error) {
    console.error("[fromhere/products create] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  プロダクトのステータス変更 (draft / published / archived)
 * ---------------------------------------------------------- */
export async function updateFromHereProductStatusAction(input: {
  productId: unknown
  status: unknown
}): Promise<UpdateFromHereProductResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (await isUserBanned(auth.session.supabase, userId)) {
      return { ok: false, error: "banned" }
    }

    if (!consumeRate(patchBuckets, PATCH_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const productId = typeof input.productId === "string" ? input.productId.trim() : ""
    if (!UUID_REGEX.test(productId)) {
      return { ok: false, error: "invalid_id" }
    }
    if (!isAllowedStatus(input.status)) {
      return { ok: false, error: "invalid_status" }
    }
    const nextStatus = input.status

    const adminClient = getSupabaseAdminClient()
    const dataClient = adminClient ?? auth.session.supabase

    const { data: existing, error: existingError } = await dataClient
      .from("newvibes_products")
      .select("id, slug, status, maker_id, admin_hidden_at")
      .eq("id", productId)
      .maybeSingle()
    if (existingError) {
      console.error("[fromhere/products status] lookup failed", existingError)
      return { ok: false, error: "internal" }
    }
    if (!existing) {
      return { ok: false, error: "not_found" }
    }
    if (existing.maker_id !== userId) {
      return { ok: false, error: "forbidden" }
    }
    /** 運営により非公開化されたプロダクトは、ユーザー側で status を変更できない。
     *  解除は管理者ページの `setFromHereProductAdminHiddenAction` 経由のみ。 */
    if (existing.admin_hidden_at != null) {
      return { ok: false, error: "admin_hidden" }
    }
    if (existing.status === nextStatus) {
      return { ok: false, error: "no_change" }
    }

    const updatePayload: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === "published" && existing.status !== "published") {
      updatePayload.posted_at = new Date().toISOString()
    }

    const { data: updated, error: updateError } = await dataClient
      .from("newvibes_products")
      .update(updatePayload)
      .eq("id", productId)
      .eq("maker_id", userId)
      .select("id, slug, status")
      .single()
    if (updateError || !updated) {
      console.error("[fromhere/products status] update failed", updateError)
      return { ok: false, error: "internal" }
    }

    return {
      ok: true,
      product: {
        id: updated.id as string,
        slug: updated.slug as string,
        status: normalizeStatus(updated.status),
      },
    }
  } catch (error) {
    console.error("[fromhere/products status] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  プロダクトのテキスト系編集
 *  画像差し替えは本フェーズではサポートしない (既存 path を保持)。
 * ---------------------------------------------------------- */
export async function updateFromHereProductContentAction(input: {
  productId: unknown
  content: {
    title?: unknown
    tagline?: unknown
    description?: unknown
    category?: unknown
    tags?: unknown
    productUrl?: unknown
    /**
     * 公開予定日（JST, `YYYY-MM-DD`）。指定された場合のみ posted_at を再計算する。
     *
     * - 既に公開済み（`posted_at <= now()`）のプロダクトでは変更不可。
     *   防御として `schedule_locked` エラーを返す。
     * - 未公開予約（`posted_at > now()`）のプロダクトのみ反映する。
     */
    scheduledDate?: unknown
  }
}): Promise<UpdateFromHereProductResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (await isUserBanned(auth.session.supabase, userId)) {
      return { ok: false, error: "banned" }
    }

    if (!consumeRate(patchBuckets, PATCH_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const productId = typeof input.productId === "string" ? input.productId.trim() : ""
    if (!UUID_REGEX.test(productId)) {
      return { ok: false, error: "invalid_id" }
    }

    const raw = input.content ?? {}
    if (
      typeof raw.title !== "string" ||
      typeof raw.tagline !== "string" ||
      typeof raw.description !== "string" ||
      typeof raw.category !== "string" ||
      typeof raw.productUrl !== "string"
    ) {
      return { ok: false, error: "invalid_payload" }
    }
    if (!Array.isArray(raw.tags) || !raw.tags.every((tag): tag is string => typeof tag === "string")) {
      return { ok: false, error: "invalid_payload" }
    }

    const adminClient = getSupabaseAdminClient()
    const dataClient = adminClient ?? auth.session.supabase

    const { data: existing, error: existingError } = await dataClient
      .from("newvibes_products")
      .select("id, slug, status, maker_id, app_icon_path, screenshot_path, posted_at")
      .eq("id", productId)
      .maybeSingle()
    if (existingError) {
      console.error("[fromhere/products content] lookup failed", existingError)
      return { ok: false, error: "internal" }
    }
    if (!existing) {
      return { ok: false, error: "not_found" }
    }
    if (existing.maker_id !== userId) {
      return { ok: false, error: "forbidden" }
    }

    const validation = validateFromHereProductDraft(
      {
        title: raw.title,
        tagline: raw.tagline,
        description: raw.description,
        category: raw.category,
        tags: raw.tags,
        productUrl: raw.productUrl,
        appIconPath: (existing.app_icon_path as string | null) ?? null,
        screenshotPath: (existing.screenshot_path as string | null) ?? null,
      },
      { makerUserId: userId },
    )
    if (!validation.ok) {
      return { ok: false, error: validation.error }
    }

    /**
     * 公開日の再スケジュール処理。
     *
     * - `scheduledDate` が文字列で指定された場合のみ評価対象。
     * - 既存プロダクトの `posted_at` が現在より過去 (= 既に公開済み) なら拒否する。
     *   公開済みの並びを後から変えると一覧体験が崩れるため。
     * - `parseFromHereScheduledDateToUtcIso` で禁止日 (2026-05-31 など) と
     *   翌日以降チェックを通す。
     */
    let nextPostedAtIso: string | undefined
    const scheduledRaw = raw.scheduledDate
    if (typeof scheduledRaw === "string" && scheduledRaw.trim().length > 0) {
      const currentPostedAtMs = new Date(existing.posted_at as string).getTime()
      if (!Number.isFinite(currentPostedAtMs) || currentPostedAtMs <= Date.now()) {
        return { ok: false, error: "schedule_locked" }
      }
      const scheduled = parseFromHereScheduledDateToUtcIso(scheduledRaw)
      if (!scheduled.ok) {
        return { ok: false, error: "scheduledDate" }
      }
      nextPostedAtIso = scheduled.iso
    }

    const updatePayload: Record<string, unknown> = {
      title: validation.value.title,
      tagline: validation.value.tagline,
      description: validation.value.description,
      category: validation.value.category,
      tags: validation.value.tags,
      product_url: validation.value.productUrl,
    }
    if (nextPostedAtIso) {
      updatePayload.posted_at = nextPostedAtIso
    }

    const { data: updated, error: updateError } = await dataClient
      .from("newvibes_products")
      .update(updatePayload)
      .eq("id", productId)
      .eq("maker_id", userId)
      .select("id, slug, status")
      .single()
    if (updateError || !updated) {
      console.error("[fromhere/products content] update failed", updateError)
      return { ok: false, error: "internal" }
    }

    /**
     * 編集成功時のキャッシュ無効化。
     * - 詳細ページ (`/fromhere/p/[slug]`) はもちろん、ホームの一覧表示にも反映される。
     * - 公開日変更 (`scheduledDate`) 時は一覧の並び順も変わるため `/fromhere` も invalidate。
     */
    safeRevalidate(
      "/fromhere",
      "/fromhere/my/products",
      `/fromhere/p/${updated.slug as string}`,
    )

    return {
      ok: true,
      product: {
        id: updated.id as string,
        slug: updated.slug as string,
        status: normalizeStatus(updated.status),
      },
    }
  } catch (error) {
    console.error("[fromhere/products content] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  管理者によるプロダクトの非公開化 / 解除
 *
 *  - 管理者 (本体 `profiles.is_admin = true`) のみ実行可能。
 *  - 非公開化 (`hidden=true`) 中はユーザー側 (`updateFromHereProductStatusAction`)
 *    から status を切り替えられない。一覧/詳細クエリも `admin_hidden_at is null`
 *    で除外するため、一般ユーザーには見えなくなる。
 *  - 解除 (`hidden=false`) はこの Action でのみ可能。
 * ---------------------------------------------------------- */
export type SetFromHereProductAdminHiddenResult =
  | { ok: true; hidden: boolean }
  | { ok: false; error: FromHereProductActionError }

export async function setFromHereProductAdminHiddenAction(input: {
  productId: unknown
  hidden: unknown
  reason?: unknown
}): Promise<SetFromHereProductAdminHiddenResult> {
  try {
    const auth = await requireActionAdmin()
    if (!auth.ok) {
      return {
        ok: false,
        error: auth.error === "unauthorized" ? "unauthorized" : "forbidden",
      }
    }
    const adminUserId = auth.session.user.id

    const productId = typeof input.productId === "string" ? input.productId.trim() : ""
    if (!UUID_REGEX.test(productId)) {
      return { ok: false, error: "invalid_id" }
    }
    const hidden = Boolean(input.hidden)
    const reasonRaw = typeof input.reason === "string" ? input.reason.trim() : ""
    const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : null

    const adminClient = getSupabaseAdminClient()
    if (!adminClient) {
      return { ok: false, error: "internal" }
    }

    const updatePayload: Record<string, unknown> = hidden
      ? {
          admin_hidden_at: new Date().toISOString(),
          admin_hidden_by: adminUserId,
          admin_hidden_reason: reason,
        }
      : {
          admin_hidden_at: null,
          admin_hidden_by: null,
          admin_hidden_reason: null,
        }

    const { data, error } = await adminClient
      .from("newvibes_products")
      .update(updatePayload)
      .eq("id", productId)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[fromhere/products admin_hidden] update failed", error)
      return { ok: false, error: "internal" }
    }
    if (!data) {
      return { ok: false, error: "not_found" }
    }
    return { ok: true, hidden }
  } catch (error) {
    console.error("[fromhere/products admin_hidden] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  プロダクト削除
 *  関連する upvotes / comments は DB の ON DELETE CASCADE で連動削除される。
 *  Storage 上の画像は best-effort で掃除する。
 * ---------------------------------------------------------- */
export async function deleteFromHereProductAction(input: {
  productId: unknown
}): Promise<DeleteFromHereProductResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const userId = auth.session.user.id

    if (!consumeRate(deleteBuckets, DELETE_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const productId = typeof input.productId === "string" ? input.productId.trim() : ""
    if (!UUID_REGEX.test(productId)) {
      return { ok: false, error: "invalid_id" }
    }

    const adminClient = getSupabaseAdminClient()
    const dataClient = adminClient ?? auth.session.supabase

    const { data: existing, error: existingError } = await dataClient
      .from("newvibes_products")
      .select("id, maker_id, app_icon_path, screenshot_path")
      .eq("id", productId)
      .maybeSingle()
    if (existingError) {
      console.error("[fromhere/products delete] lookup failed", existingError)
      return { ok: false, error: "internal" }
    }
    if (!existing) {
      return { ok: false, error: "not_found" }
    }
    if (existing.maker_id !== userId) {
      return { ok: false, error: "forbidden" }
    }

    const { error: deleteError } = await dataClient
      .from("newvibes_products")
      .delete()
      .eq("id", productId)
      .eq("maker_id", userId)
    if (deleteError) {
      console.error("[fromhere/products delete] delete failed", deleteError)
      return { ok: false, error: "internal" }
    }

    const appIconPath = (existing.app_icon_path as string | null) ?? null
    const screenshotPath = (existing.screenshot_path as string | null) ?? null
    if (appIconPath) {
      try {
        await dataClient.storage.from("newvibes-app-icons").remove([appIconPath])
      } catch {
        /* best-effort cleanup */
      }
    }
    if (screenshotPath) {
      try {
        await dataClient.storage.from("newvibes-screenshots").remove([screenshotPath])
      } catch {
        /* best-effort cleanup */
      }
    }

    return { ok: true, deleted: true }
  } catch (error) {
    console.error("[fromhere/products delete] unexpected", error)
    return { ok: false, error: "internal" }
  }
}
