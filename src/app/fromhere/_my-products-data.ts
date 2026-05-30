import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
  type FromHereCategory,
} from "@/fromhere/_product-validation"

/** ----------------------------------------------------------
 *  /fromhere/my/products ページ用のサーバー側データフェッチャ
 *
 *  - ログイン前提。認証されていない場合は `viewer: { isAuthenticated: false }` を返す。
 *  - 自分のプロダクトを status 問わず取得し、集計とともに返す。
 *  - RLS により、他人のプロダクトはそもそも返らない。
 * ---------------------------------------------------------- */

export type MyProductStatus = "draft" | "published" | "archived"

export type MyProduct = {
  id: string
  slug: string
  title: string
  tagline: string
  category: FromHereCategory
  appIconUrl: string | null
  screenshotUrl: string | null
  upvoteCount: number
  commentCount: number
  postedAt: string
  status: MyProductStatus
  /** 運営により非公開化されているか。true の場合、ユーザーは status を変更できない。 */
  adminHidden: boolean
}

export type MyProductsStats = {
  total: number
  published: number
  draft: number
  archived: number
}

export type MyProductsData = {
  products: MyProduct[]
  stats: MyProductsStats
  viewer:
    | { isAuthenticated: false; hasProfile: false }
    | { isAuthenticated: true; hasProfile: boolean; userId: string }
}

/** ----------------------------------------------------------
 *  Supabase クライアント（cookies で session を読み出すため毎回生成）
 * ---------------------------------------------------------- */
async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

export async function fetchMyProducts(): Promise<MyProductsData> {
  const supabase = await getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      products: [],
      stats: { total: 0, published: 0, draft: 0, archived: 0 },
      viewer: { isAuthenticated: false, hasProfile: false },
    }
  }

  const [profileResult, productsResult] = await Promise.all([
    supabase.from("newvibes_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase
      .from("newvibes_products")
      .select(
        "id, slug, title, tagline, category, app_icon_path, screenshot_path, upvote_count, comment_count, posted_at, status, admin_hidden_at",
      )
      .eq("maker_id", user.id)
      .order("posted_at", { ascending: false }),
  ])

  const hasProfile = Boolean(profileResult.data)
  const rows = (productsResult.data ?? []) as ProductRow[]

  const products: MyProduct[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    category: row.category as FromHereCategory,
    appIconUrl: row.app_icon_path
      ? buildPublicUrl(FROMHERE_APP_ICONS_BUCKET, row.app_icon_path)
      : null,
    screenshotUrl: row.screenshot_path
      ? buildPublicUrl(FROMHERE_SCREENSHOTS_BUCKET, row.screenshot_path)
      : null,
    upvoteCount: typeof row.upvote_count === "number" ? row.upvote_count : 0,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : 0,
    postedAt: row.posted_at,
    status: normalizeStatus(row.status),
    adminHidden: row.admin_hidden_at != null,
  }))

  const stats: MyProductsStats = {
    total: products.length,
    published: products.filter((p) => p.status === "published").length,
    draft: products.filter((p) => p.status === "draft").length,
    archived: products.filter((p) => p.status === "archived").length,
  }

  return {
    products,
    stats,
    viewer: {
      isAuthenticated: true,
      hasProfile,
      userId: user.id,
    },
  }
}

function normalizeStatus(value: unknown): MyProductStatus {
  if (value === "draft" || value === "archived") {
    return value
  }
  return "published"
}

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

type ProductRow = {
  id: string
  slug: string
  title: string
  tagline: string
  category: string
  app_icon_path: string | null
  screenshot_path: string | null
  upvote_count: number
  comment_count: number
  posted_at: string
  status: string
  admin_hidden_at: string | null
}
