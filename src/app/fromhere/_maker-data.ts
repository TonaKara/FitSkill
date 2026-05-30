import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { FromHereCategory } from "@/fromhere/_product-validation"
import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
} from "@/fromhere/_product-validation"
import { resolveFromHereAvatarUrl } from "@/fromhere/_avatar-url"
import {
  getCurrentLoginStreakBadge,
  type LoginStreakBadgeId,
} from "@/fromhere/_login-streak"

/** ----------------------------------------------------------
 *  メーカープロフィールページに必要なデータ型
 * ---------------------------------------------------------- */

export type MakerProfileData = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  createdAt: string
  stats: {
    totalProducts: number
    totalUpvotes: number
    totalComments: number
  }
  /**
   * 連続ログインバッジ。
   * - currentStreak / longestStreak はそのまま日数。
   * - currentBadge はしきい値を満たす最高ランクのバッジ id（無ければ null）。
   */
  loginStreak: {
    currentStreak: number
    longestStreak: number
    currentBadge: LoginStreakBadgeId | null
  } | null
  products: MakerProduct[]
  viewer: {
    isAuthenticated: boolean
    isSelf: boolean
  }
}

export type MakerProduct = {
  id: string
  slug: string
  title: string
  tagline: string
  category: FromHereCategory
  tags: string[]
  productUrl: string
  appIconUrl: string | null
  screenshotUrl: string | null
  upvoteCount: number
  commentCount: number
  postedAt: string
  status: "draft" | "published"
}

/** ----------------------------------------------------------
 *  Supabase クライアント生成（読み取り専用 + Cookie 認証共有）
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
 *  handle → メーカーデータの取得
 *  - profile が存在しない場合は null を返し、呼び出し側で notFound() させる。
 *  - 投稿は最新順 50 件まで。閲覧者が本人なら draft も返す。
 * ---------------------------------------------------------- */

const MAKER_PRODUCTS_LIMIT = 50

export async function fetchMakerProfile(handleInput: string): Promise<MakerProfileData | null> {
  const handle = normalizeHandleParam(handleInput)
  if (!handle) {
    return null
  }

  const supabase = await getSupabase()

  /**
   * `select("*")` で取得することで、古いマイグレーション環境（`avatar_url` / `avatar_path`
   * カラムが無い等）でも SELECT エラーで「メーカーが見つかりません」になることを避ける。
   */
  const [profileResult, userResult] = await Promise.all([
    supabase.from("newvibes_profiles").select("*").eq("handle", handle).maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (profileResult.error) {
    console.warn(
      "[fetchMakerProfile] newvibes_profiles fetch failed",
      profileResult.error.message ?? profileResult.error,
    )
    return null
  }
  if (!profileResult.data) {
    return null
  }

  const profileRow = profileResult.data as Partial<ProfileRow>
  if (typeof profileRow.id !== "string" || typeof profileRow.handle !== "string") {
    return null
  }
  const viewerUserId = userResult.data?.user?.id ?? null
  const isSelf = Boolean(viewerUserId && viewerUserId === (profileRow.id as string))

  /**
   * 自分のページでは draft / 公開予約 / 運営非公開も含めて取得する（本人には可視性を保つ）。
   * 他者ページでは published かつ posted_at <= now() かつ admin_hidden_at IS NULL のみ。
   * RLS でも保護されているが、UI の都合上 status / posted_at を意識して filter したい。
   */
  const productsQuery = supabase
    .from("newvibes_products")
    .select(
      "id, slug, title, tagline, category, tags, product_url, app_icon_path, screenshot_path, upvote_count, comment_count, posted_at, status, admin_hidden_at",
    )
    .eq("maker_id", profileRow.id as string)
    .order("posted_at", { ascending: false })
    .limit(MAKER_PRODUCTS_LIMIT)

  const finalProductsQuery = isSelf
    ? productsQuery
    : productsQuery
        .eq("status", "published")
        .lte("posted_at", new Date().toISOString())
        .is("admin_hidden_at", null)

  const [{ data: productsRows }, streakResult, mainProfileResult] = await Promise.all([
    finalProductsQuery,
    /**
     * `newvibes_login_streaks` テーブルが未マイグレーションの環境では error が返るが、
     * Promise.all は reject せず、ここでは null に倒せばよい。
     */
    supabase
      .from("newvibes_login_streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", profileRow.id as string)
      .maybeSingle(),
    /**
     * 本体 `profiles.avatar_url` を取得し、FromHere 側でも統一して表示する。
     * 公開列のため anon でも SELECT 可能（本体 RLS で許可済み）。
     */
    supabase.from("profiles").select("avatar_url").eq("id", profileRow.id as string).maybeSingle(),
  ])
  const productRows = (productsRows ?? []) as ProductRow[]
  const adminHiddenIds = new Set(
    productRows
      .filter((row) => row.admin_hidden_at != null)
      .map((row) => row.id),
  )
  const products: MakerProduct[] = productRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    category: row.category as FromHereCategory,
    tags: Array.isArray(row.tags) ? row.tags : [],
    productUrl: row.product_url,
    appIconUrl: row.app_icon_path ? buildPublicUrl(FROMHERE_APP_ICONS_BUCKET, row.app_icon_path) : null,
    screenshotUrl: row.screenshot_path
      ? buildPublicUrl(FROMHERE_SCREENSHOTS_BUCKET, row.screenshot_path)
      : null,
    upvoteCount: typeof row.upvote_count === "number" ? row.upvote_count : 0,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : 0,
    postedAt: row.posted_at,
    status: row.status === "draft" ? "draft" : "published",
  }))

  /** 統計は「公開済みかつ公開予約日が到来し、運営非公開でないもの」だけで計算する。 */
  const nowMs = Date.now()
  const publishedProducts = products.filter(
    (p) =>
      p.status === "published" &&
      new Date(p.postedAt).getTime() <= nowMs &&
      !adminHiddenIds.has(p.id),
  )
  const stats = {
    totalProducts: publishedProducts.length,
    totalUpvotes: publishedProducts.reduce((sum, p) => sum + p.upvoteCount, 0),
    totalComments: publishedProducts.reduce((sum, p) => sum + p.commentCount, 0),
  }

  const streakRow =
    streakResult && !streakResult.error && streakResult.data
      ? (streakResult.data as { current_streak: number; longest_streak: number })
      : null
  const loginStreak = streakRow
    ? {
        currentStreak: Number(streakRow.current_streak) || 0,
        longestStreak: Number(streakRow.longest_streak) || 0,
        currentBadge: getCurrentLoginStreakBadge(Number(streakRow.current_streak) || 0),
      }
    : null

  const mainAvatarUrl =
    mainProfileResult && !mainProfileResult.error && mainProfileResult.data
      ? ((mainProfileResult.data as { avatar_url: unknown }).avatar_url as string | null) ?? null
      : null

  return {
    id: profileRow.id as string,
    handle: profileRow.handle as string,
    displayName: typeof profileRow.display_name === "string" ? profileRow.display_name : "",
    bio: typeof profileRow.bio === "string" ? profileRow.bio : null,
    avatarUrl: resolveFromHereAvatarUrl({
      mainAvatarUrl,
      avatarPath: typeof profileRow.avatar_path === "string" ? profileRow.avatar_path : null,
      avatarUrl: typeof profileRow.avatar_url === "string" ? profileRow.avatar_url : null,
    }),
    createdAt: typeof profileRow.created_at === "string" ? profileRow.created_at : new Date().toISOString(),
    stats,
    loginStreak,
    products,
    viewer: {
      isAuthenticated: Boolean(viewerUserId),
      isSelf,
    },
  }
}

/** ----------------------------------------------------------
 *  URL パラメータの handle 正規化
 *  - URL に `@` を付けて渡すスタイル（例: `@grit_official`）にも対応。
 *  - 大文字小文字は DB 側で `lower(handle)` 制約と一致するよう小文字化。
 * ---------------------------------------------------------- */
export function normalizeHandleParam(raw: string): string | null {
  if (typeof raw !== "string") {
    return null
  }
  let value = raw.trim()
  if (value.startsWith("@")) {
    value = value.slice(1)
  }
  value = value.toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(value)) {
    return null
  }
  return value
}

/** ----------------------------------------------------------
 *  Storage public URL ビルダー
 * ---------------------------------------------------------- */
function buildPublicUrl(bucket: string, path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!base) {
    return null
  }
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

/** ----------------------------------------------------------
 *  内部生型
 * ---------------------------------------------------------- */

type ProfileRow = {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  avatar_path: string | null
  created_at: string
}

type ProductRow = {
  id: string
  slug: string
  title: string
  tagline: string
  category: string
  tags: string[] | null
  product_url: string
  app_icon_path: string | null
  screenshot_path: string | null
  upvote_count: number
  comment_count: number
  posted_at: string
  status: string
  admin_hidden_at: string | null
}
