import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { ADMIN_REVIEW_ICONS_BUCKET } from "@/fromhere/_admin-review-validation"

/** ----------------------------------------------------------
 *  公開・管理 共通の運営レビュー型
 * ---------------------------------------------------------- */

export type AdminReviewListItem = {
  id: string
  slug: string
  title: string
  summary: string
  iconUrl: string | null
  status: "draft" | "published"
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminReviewDetail = AdminReviewListItem & {
  body: string
}

/** トップ用カルーセルの取得件数（5 × 3 ページ） */
export const ADMIN_REVIEW_HOME_LIMIT = 15

/** ----------------------------------------------------------
 *  Supabase server client（読み取り専用 / Cookie 認証共有）
 * ---------------------------------------------------------- */

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          /* 読み取り専用 */
        },
      },
    },
  )
}

/** ----------------------------------------------------------
 *  最新の公開済みレビューを N 件取得（ホーム用）
 * ---------------------------------------------------------- */
export async function fetchLatestPublishedAdminReviews(
  limit = ADMIN_REVIEW_HOME_LIMIT,
): Promise<AdminReviewListItem[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from("newvibes_admin_reviews")
    .select("id, slug, title, summary, icon_path, icon_url, status, published_at, created_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) {
    console.warn(
      "[fetchLatestPublishedAdminReviews] failed",
      error.message ?? error,
    )
    return []
  }
  return (data ?? []).map(mapRowToListItem)
}

/** ----------------------------------------------------------
 *  slug から公開済みレビュー1件を取得（詳細ページ用）
 * ---------------------------------------------------------- */
export async function fetchPublishedAdminReviewBySlug(
  slug: string,
): Promise<AdminReviewDetail | null> {
  if (!isValidSlug(slug)) {
    return null
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from("newvibes_admin_reviews")
    .select(
      "id, slug, title, summary, body, icon_path, icon_url, status, published_at, created_at, updated_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return mapRowToDetail(data)
}

/** ----------------------------------------------------------
 *  管理一覧（draft 含む）を全件返す
 *  - 並びは `created_at desc`
 *  - 件数は最大 200 件（運営用なのでハードリミットで十分）
 * ---------------------------------------------------------- */
export async function fetchAdminReviewsForAdmin(): Promise<AdminReviewListItem[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from("newvibes_admin_reviews")
    .select("id, slug, title, summary, icon_path, icon_url, status, published_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) {
    console.warn(
      "[fetchAdminReviewsForAdmin] failed",
      error.message ?? error,
    )
    return []
  }
  return (data ?? []).map(mapRowToListItem)
}

/** ----------------------------------------------------------
 *  ID から管理者向けに 1 件取得（draft も含む）
 * ---------------------------------------------------------- */
export async function fetchAdminReviewByIdForAdmin(
  id: string,
): Promise<AdminReviewDetail | null> {
  if (typeof id !== "string" || id.length === 0) {
    return null
  }
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from("newvibes_admin_reviews")
    .select(
      "id, slug, title, summary, body, icon_path, icon_url, status, published_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return mapRowToDetail(data)
}

/** ----------------------------------------------------------
 *  内部ヘルパー
 * ---------------------------------------------------------- */

type RawRow = {
  id: string
  slug: string
  title: string
  summary: string
  body?: string
  icon_path: string | null
  icon_url: string | null
  status: string
  published_at: string | null
  created_at: string
  updated_at: string
}

function mapRowToListItem(row: unknown): AdminReviewListItem {
  const r = row as RawRow
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    iconUrl: resolveIconUrl(r.icon_url, r.icon_path),
    status: r.status === "draft" ? "draft" : "published",
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapRowToDetail(row: unknown): AdminReviewDetail {
  const list = mapRowToListItem(row)
  const r = row as RawRow
  return { ...list, body: r.body ?? "" }
}

/**
 * 表示用アイコン URL を解決する。
 * - 既に絶対 URL (icon_url) があればそれを使う。
 * - 無ければ icon_path を newvibes-admin-review-icons バケットの public URL に変換。
 */
export function resolveIconUrl(
  iconUrl: string | null | undefined,
  iconPath: string | null | undefined,
): string | null {
  const direct = typeof iconUrl === "string" ? iconUrl.trim() : ""
  if (direct.length > 0) {
    return direct
  }
  const path = typeof iconPath === "string" ? iconPath.trim() : ""
  if (path.length === 0) {
    return null
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!base) {
    return null
  }
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${ADMIN_REVIEW_ICONS_BUCKET}/${encodeStoragePath(path)}`
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value)
}
