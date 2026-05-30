"use server"

import "server-only"

import { revalidatePath } from "next/cache"
import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireActionAdmin } from "@/lib/supabase/action-admin"
import {
  buildBaseSlug,
  buildRandomFallbackSlug,
  buildSlugWithSuffix,
  FROMHERE_SLUG_REGEX,
} from "@/fromhere/_slug"
import {
  validateAdminReviewDraft,
  type AdminReviewDraft,
  type AdminReviewInputErrorKey,
} from "@/fromhere/_admin-review-validation"
import { resolveIconUrl } from "@/fromhere/_admin-reviews-data"

/**
 * FromHere の運営レビュー関連ページのキャッシュをまとめて invalidate。
 *
 * - クライアントの `router.refresh()` だけに頼ると、リダイレクト先で重い RSC fetch が
 *   2 回走り体感が遅くなる。Server Action 内で `revalidatePath` を呼べばクライアントの
 *   余分な refresh が不要になる。
 * - 失敗を握りつぶし、レビュー操作の成功は阻害しない。
 */
function safeRevalidate(...paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.warn("[fromhere/admin-reviews/revalidate] failed", { path, error })
    }
  }
}

/** ----------------------------------------------------------
 *  FromHere 運営レビュー Server Actions (admin 専用)
 *
 *  Route Handler の代替実装。理由は他の `_*-actions.ts` と同じ。
 *
 *  クライアント:
 *    - `admin/reviews/AdminReviewForm.tsx` (create / update / delete)
 *    - `admin/reviews/AdminReviewsListClient.tsx` (delete)
 * ---------------------------------------------------------- */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AdminReviewSummary = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  iconUrl: string | null
  status: "draft" | "published"
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminReviewActionError =
  | "unauthorized"
  | "forbidden"
  | "internal"
  | "invalid_id"
  | "invalid_json"
  | "not_found"
  | "validation"

export type AdminReviewActionResult =
  | { ok: true; review: AdminReviewSummary }
  | { ok: false; error: AdminReviewActionError; errors?: AdminReviewInputErrorKey[] }

export type DeleteAdminReviewResult =
  | { ok: true; deleted: true }
  | { ok: false; error: AdminReviewActionError }

const SLUG_RETRY_LIMIT = 10

async function allocateUniqueSlug(
  supabase: SupabaseClient,
  baseSlug: string,
): Promise<string> {
  const base = baseSlug.length > 0 ? baseSlug : "review"
  for (let i = 1; i <= SLUG_RETRY_LIMIT; i++) {
    const candidate = buildSlugWithSuffix(base, i)
    if (!FROMHERE_SLUG_REGEX.test(candidate)) {
      continue
    }
    const { data } = await supabase
      .from("newvibes_admin_reviews")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle()
    if (!data) {
      return candidate
    }
  }
  return buildRandomFallbackSlug(base, () => randomUUID().replace(/-/g, ""))
}

function toAdminReviewSummary(row: {
  id: unknown
  slug: unknown
  title: unknown
  summary: unknown
  body: unknown
  icon_path: unknown
  icon_url: unknown
  status: unknown
  published_at: unknown
  created_at: unknown
  updated_at: unknown
}): AdminReviewSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    body: String(row.body),
    iconUrl: resolveIconUrl(
      (row.icon_url as string | null) ?? null,
      (row.icon_path as string | null) ?? null,
    ),
    status: row.status === "draft" ? "draft" : "published",
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

/** ----------------------------------------------------------
 *  新規作成
 * ---------------------------------------------------------- */
export async function createFromHereAdminReviewAction(input: {
  title?: unknown
  summary?: unknown
  body?: unknown
  iconPath?: unknown
  iconUrl?: unknown
  status?: unknown
  slug?: unknown
}): Promise<AdminReviewActionResult> {
  try {
    const auth = await requireActionAdmin()
    if (!auth.ok) {
      return { ok: false, error: auth.error === "forbidden" ? "forbidden" : "unauthorized" }
    }
    const { supabase, user } = auth.session

    const draft: AdminReviewDraft = {
      title: typeof input.title === "string" ? input.title : "",
      summary: typeof input.summary === "string" ? input.summary : "",
      body: typeof input.body === "string" ? input.body : "",
      iconPath: typeof input.iconPath === "string" ? input.iconPath : null,
      iconUrl: typeof input.iconUrl === "string" ? input.iconUrl : null,
      status: input.status === "draft" ? "draft" : "published",
    }
    const validation = validateAdminReviewDraft(draft)
    if (!validation.ok) {
      return { ok: false, error: "validation", errors: validation.errors }
    }
    const value = validation.value

    const requestedSlug = typeof input.slug === "string" ? input.slug.trim() : ""
    const baseSlug =
      requestedSlug && FROMHERE_SLUG_REGEX.test(requestedSlug)
        ? requestedSlug
        : buildBaseSlug(value.title)
    const slug = await allocateUniqueSlug(supabase, baseSlug || "review")

    const { data, error } = await supabase
      .from("newvibes_admin_reviews")
      .insert({
        slug,
        title: value.title,
        summary: value.summary,
        body: value.body,
        icon_path: value.iconPath,
        icon_url: value.iconUrl,
        status: value.status,
        created_by: user.id,
      })
      .select(
        "id, slug, title, summary, body, icon_path, icon_url, status, published_at, created_at, updated_at",
      )
      .single()
    if (error || !data) {
      console.error("[fromhere/admin/reviews create] insert failed", error)
      return { ok: false, error: "internal" }
    }

    /**
     * 新規作成したレビューは FromHere トップの「編集部セレクト」カルーセルにも反映される。
     * 一覧 / トップ / 当該詳細ページのキャッシュを invalidate しておく。
     */
    safeRevalidate("/fromhere", "/fromhere/admin/reviews", `/fromhere/reviews/${data.slug}`)

    return { ok: true, review: toAdminReviewSummary(data) }
  } catch (error) {
    console.error("[fromhere/admin/reviews create] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  更新
 * ---------------------------------------------------------- */
export async function updateFromHereAdminReviewAction(input: {
  id: unknown
  title?: unknown
  summary?: unknown
  body?: unknown
  iconPath?: unknown
  iconUrl?: unknown
  status?: unknown
}): Promise<AdminReviewActionResult> {
  try {
    const auth = await requireActionAdmin()
    if (!auth.ok) {
      return { ok: false, error: auth.error === "forbidden" ? "forbidden" : "unauthorized" }
    }
    const { supabase } = auth.session

    const id = typeof input.id === "string" ? input.id.trim() : ""
    if (!UUID_REGEX.test(id)) {
      return { ok: false, error: "invalid_id" }
    }

    const draft: AdminReviewDraft = {
      title: typeof input.title === "string" ? input.title : "",
      summary: typeof input.summary === "string" ? input.summary : "",
      body: typeof input.body === "string" ? input.body : "",
      iconPath: typeof input.iconPath === "string" ? input.iconPath : null,
      iconUrl: typeof input.iconUrl === "string" ? input.iconUrl : null,
      status: input.status === "draft" ? "draft" : "published",
    }
    const validation = validateAdminReviewDraft(draft)
    if (!validation.ok) {
      return { ok: false, error: "validation", errors: validation.errors }
    }
    const value = validation.value

    const { data, error } = await supabase
      .from("newvibes_admin_reviews")
      .update({
        title: value.title,
        summary: value.summary,
        body: value.body,
        icon_path: value.iconPath,
        icon_url: value.iconUrl,
        status: value.status,
      })
      .eq("id", id)
      .select(
        "id, slug, title, summary, body, icon_path, icon_url, status, published_at, created_at, updated_at",
      )
      .maybeSingle()
    if (error) {
      console.error("[fromhere/admin/reviews update] update failed", error)
      return { ok: false, error: "internal" }
    }
    if (!data) {
      return { ok: false, error: "not_found" }
    }

    /**
     * 更新内容 (タイトル / 本文 / 公開状態) は FromHere トップと当該詳細ページに反映。
     * 管理一覧も更新を反映させたいので併せて invalidate。
     */
    safeRevalidate("/fromhere", "/fromhere/admin/reviews", `/fromhere/reviews/${data.slug}`)

    return { ok: true, review: toAdminReviewSummary(data) }
  } catch (error) {
    console.error("[fromhere/admin/reviews update] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  削除
 * ---------------------------------------------------------- */
export async function deleteFromHereAdminReviewAction(input: {
  id: unknown
}): Promise<DeleteAdminReviewResult> {
  try {
    const auth = await requireActionAdmin()
    if (!auth.ok) {
      return { ok: false, error: auth.error === "forbidden" ? "forbidden" : "unauthorized" }
    }
    const { supabase } = auth.session

    const id = typeof input.id === "string" ? input.id.trim() : ""
    if (!UUID_REGEX.test(id)) {
      return { ok: false, error: "invalid_id" }
    }

    const { error } = await supabase
      .from("newvibes_admin_reviews")
      .delete()
      .eq("id", id)
    if (error) {
      console.error("[fromhere/admin/reviews delete] delete failed", error)
      return { ok: false, error: "internal" }
    }

    /**
     * 削除後は FromHere トップ・管理一覧から該当レビューを消す必要がある。
     * 詳細 URL は知らないため、トップ / 一覧のみ invalidate。
     */
    safeRevalidate("/fromhere", "/fromhere/admin/reviews")

    return { ok: true, deleted: true }
  } catch (error) {
    console.error("[fromhere/admin/reviews delete] unexpected", error)
    return { ok: false, error: "internal" }
  }
}
