import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
  type FromHereCategory,
} from "@/fromhere/_product-validation"

/** ----------------------------------------------------------
 *  /fromhere/p/[slug]/edit ページ用のサーバー側データフェッチャ
 *
 *  - ログイン + プロフィール + 所有者であることを SSR で検証する。
 *  - RLS により、自分以外のプロダクト row は draft/archived だと返ってこないが、
 *    本フェッチャでは status を問わず `maker_id = uid` で絞り込み、
 *    自分のものか否かを明示的にチェックする（誤判定防止）。
 *  - 画像 URL は表示用にプリビルドするが、編集時は path のみが送信され、
 *    画像差し替え自体は本フェーズでは扱わない。
 * ---------------------------------------------------------- */

export type ProductEditInitialValues = {
  id: string
  slug: string
  title: string
  tagline: string
  description: string
  category: FromHereCategory
  tags: string[]
  productUrl: string
  appIconPath: string | null
  appIconUrl: string | null
  screenshotPath: string | null
  screenshotUrl: string | null
  /**
   * 公開予定日時 (UTC ISO 文字列)。クライアント側で現在時刻と比較し、
   * 未来 (= 未公開予約) のときのみ公開日の編集 UI を表示する判定に使う。
   */
  postedAtIso: string | null
}

export type ProductEditResult =
  | { state: "unauthenticated" }
  | { state: "no-profile"; userId: string }
  | { state: "not-found" }
  | { state: "forbidden" }
  | { state: "ok"; product: ProductEditInitialValues }

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

export async function fetchFromHereProductForEdit(slug: string): Promise<ProductEditResult> {
  if (typeof slug !== "string" || slug.length === 0) {
    return { state: "not-found" }
  }
  const supabase = await getSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { state: "unauthenticated" }
  }

  const [profileResult, productResult] = await Promise.all([
    supabase.from("newvibes_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase
      .from("newvibes_products")
      .select(
        "id, slug, title, tagline, description, category, tags, product_url, app_icon_path, screenshot_path, maker_id, posted_at",
      )
      .eq("slug", slug)
      .maybeSingle(),
  ])

  if (!profileResult.data) {
    return { state: "no-profile", userId: user.id }
  }

  const row = productResult.data as ProductRow | null
  if (!row) {
    return { state: "not-found" }
  }
  if (row.maker_id !== user.id) {
    return { state: "forbidden" }
  }

  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string")
    : []

  return {
    state: "ok",
    product: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      tagline: row.tagline,
      description: typeof row.description === "string" ? row.description : "",
      category: row.category as FromHereCategory,
      tags,
      productUrl: typeof row.product_url === "string" ? row.product_url : "",
      appIconPath: row.app_icon_path,
      appIconUrl: row.app_icon_path
        ? buildPublicUrl(FROMHERE_APP_ICONS_BUCKET, row.app_icon_path)
        : null,
      screenshotPath: row.screenshot_path,
      screenshotUrl: row.screenshot_path
        ? buildPublicUrl(FROMHERE_SCREENSHOTS_BUCKET, row.screenshot_path)
        : null,
      postedAtIso: typeof row.posted_at === "string" ? row.posted_at : null,
    },
  }
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
  description: string | null
  category: string
  tags: unknown
  product_url: string | null
  app_icon_path: string | null
  screenshot_path: string | null
  maker_id: string
  posted_at: string | null
}
