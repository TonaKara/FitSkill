import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import type { FromHereCategory } from "@/fromhere/_product-validation"
import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
} from "@/fromhere/_product-validation"
import { resolveFromHereAvatarUrl } from "@/fromhere/_avatar-url"
import { HOME_SECTION_LIMITS, HOME_RANKING_THRESHOLD } from "@/fromhere/_home-config"

/** 定数は `_home-config.ts` を一次定義として持ち、後方互換のため re-export */
export { HOME_SECTION_LIMITS, HOME_RANKING_THRESHOLD }

/** ----------------------------------------------------------
 *  ホームページ用データ型（クライアント送信向けに整形済み）
 * ---------------------------------------------------------- */

export type HomeProduct = {
  id: string
  slug: string
  title: string
  tagline: string
  description: string | null
  category: FromHereCategory
  tags: string[]
  productUrl: string
  appIconUrl: string | null
  screenshotUrl: string | null
  upvoteCount: number
  commentCount: number
  postedAt: string
  maker: {
    id: string
    handle: string
    displayName: string
    avatarUrl: string | null
  }
}

export type HomeSection = {
  /** 表示用に取得済みのプロダクト（応援数 desc）。 */
  products: HomeProduct[]
  /** セクション期間全体での件数。`products.length` を上回ることがある（その場合は「すべて見る」が必要）。 */
  totalCount: number
}

export type HomeData = {
  sections: {
    today: HomeSection
    thisMonth: HomeSection
    lastMonth: HomeSection
    older: HomeSection
  }
  /** ログイン中ユーザーが既に upvote 済みのプロダクト ID 一覧 */
  upvotedProductIds: string[]
  /** 認証 + プロフィール完了状態（CTA 分岐などで使う） */
  viewer: {
    isAuthenticated: boolean
    hasProfile: boolean
  }
}

/** ----------------------------------------------------------
 *  内部: Supabase server client の生成
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
          /* SSR 時の読み取り専用クライアント。書き込み不要 */
        },
      },
    },
  )
}

/** ----------------------------------------------------------
 *  JST 0:00 境界の計算
 *  - DB に保存される posted_at は ISO 8601 (UTC) の前提。
 *  - 日付の切れ目はサーバー側のタイムゾーンに依存させず、JST に固定する。
 * ---------------------------------------------------------- */
export type JstBoundaries = {
  /** 今日 00:00 JST を UTC ISO に変換したもの（このリクエスト時点での「今日の境界」） */
  dayStartIso: string
  /** 今月 1 日 00:00 JST */
  thisMonthStartIso: string
  /** 先月 1 日 00:00 JST */
  lastMonthStartIso: string
}

export function getJstHomeBoundaries(now: Date = new Date()): JstBoundaries {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000
  const nowJst = new Date(now.getTime() + JST_OFFSET_MS)
  const yearJst = nowJst.getUTCFullYear()
  const monthJst = nowJst.getUTCMonth()
  const dateJst = nowJst.getUTCDate()

  const dayStartMs = Date.UTC(yearJst, monthJst, dateJst) - JST_OFFSET_MS
  const thisMonthStartMs = Date.UTC(yearJst, monthJst, 1) - JST_OFFSET_MS
  // `Date.UTC` は month=-1 のとき自動的に前年 12 月になるため境界処理は不要。
  const lastMonthStartMs = Date.UTC(yearJst, monthJst - 1, 1) - JST_OFFSET_MS

  return {
    dayStartIso: new Date(dayStartMs).toISOString(),
    thisMonthStartIso: new Date(thisMonthStartMs).toISOString(),
    lastMonthStartIso: new Date(lastMonthStartMs).toISOString(),
  }
}

/** ----------------------------------------------------------
 *  メーカープロフィールを一括取得して HomeProduct を構築する共通処理
 *  - 4 セクションの product 行をまとめて受け取り、profile を 1 度だけ SELECT する。
 * ---------------------------------------------------------- */
type ProductRow = {
  id: string
  slug: string
  title: string
  tagline: string
  description: string | null
  category: string
  tags: string[] | null
  product_url: string
  app_icon_path: string | null
  screenshot_path: string | null
  upvote_count: number
  comment_count: number
  posted_at: string
  maker_id: string
}

type MakerProfileRow = {
  id: string
  handle: string
  display_name: string
  avatar_path: string | null
  avatar_url: string | null
}

async function resolveMakers(
  supabase: SupabaseClient,
  rows: ProductRow[],
): Promise<{
  profilesById: Map<string, MakerProfileRow>
  mainAvatarById: Map<string, string | null>
}> {
  const makerIds = Array.from(new Set(rows.map((row) => row.maker_id))).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  )
  const profilesById = new Map<string, MakerProfileRow>()
  const mainAvatarById = new Map<string, string | null>()
  if (makerIds.length === 0) {
    return { profilesById, mainAvatarById }
  }
  const [{ data: profiles }, { data: mainProfiles }] = await Promise.all([
    supabase
      .from("newvibes_profiles")
      .select("id, handle, display_name, avatar_path, avatar_url")
      .in("id", makerIds),
    supabase.from("profiles").select("id, avatar_url").in("id", makerIds),
  ])
  if (profiles) {
    for (const row of profiles as MakerProfileRow[]) {
      profilesById.set(row.id, row)
    }
  }
  if (mainProfiles) {
    for (const row of mainProfiles as { id: string; avatar_url: string | null }[]) {
      mainAvatarById.set(row.id, row.avatar_url ?? null)
    }
  }
  return { profilesById, mainAvatarById }
}

/** 単一行 → HomeProduct への変換ヘルパー */
function rowToHomeProduct(
  row: ProductRow,
  profilesById: Map<string, MakerProfileRow>,
  mainAvatarById: Map<string, string | null>,
): HomeProduct {
  const profile = profilesById.get(row.maker_id)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description ?? null,
    category: row.category as FromHereCategory,
    tags: Array.isArray(row.tags) ? row.tags : [],
    productUrl: row.product_url,
    appIconUrl: row.app_icon_path
      ? buildPublicUrl(FROMHERE_APP_ICONS_BUCKET, row.app_icon_path)
      : null,
    screenshotUrl: row.screenshot_path
      ? buildPublicUrl(FROMHERE_SCREENSHOTS_BUCKET, row.screenshot_path)
      : null,
    upvoteCount: typeof row.upvote_count === "number" ? row.upvote_count : 0,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : 0,
    postedAt: row.posted_at,
    maker: {
      id: row.maker_id,
      handle: profile?.handle ?? "",
      displayName: profile?.display_name ?? "",
      avatarUrl: resolveFromHereAvatarUrl({
        mainAvatarUrl: mainAvatarById.get(row.maker_id) ?? null,
        avatarPath: profile?.avatar_path,
        avatarUrl: profile?.avatar_url,
      }),
    },
  }
}

/** プロダクトの SELECT 列。各クエリで共有する */
const PRODUCT_SELECT_COLUMNS =
  "id, slug, title, tagline, description, category, tags, product_url, app_icon_path, screenshot_path, upvote_count, comment_count, posted_at, maker_id"

/** ----------------------------------------------------------
 *  メインの fetch エントリポイント（4 セクション + 認証情報）
 *  - 各セクションは応援数 desc + 投稿日 desc の同点処理で取得する。
 *  - lastMonth / older は表示件数のみ取得する（「すべて見る」が無いため count 不要）。
 * ---------------------------------------------------------- */
export async function fetchFromHereHomeData(): Promise<HomeData> {
  const supabase = await getSupabase()
  const { dayStartIso, thisMonthStartIso, lastMonthStartIso } = getJstHomeBoundaries()
  /**
   * 公開予約済み（`posted_at` が未来）の行は一般ユーザーから不可視にする。
   * - 公開日（JST）の 00:00 が来た瞬間からホームに並ぶ仕様。
   * - 自分のプロダクト一覧（`my/products`）はこのフィルタを適用しないので、本人には常に表示される。
   */
  const nowIso = new Date().toISOString()

  /**
   * 運営により非公開化されたプロダクト (`admin_hidden_at != null`) は、
   * 一般ユーザー向け一覧から除外する。詳細ページは `_product-detail-data.ts` 側で
   * オーナーにのみ表示する判定をしている。
   */
  const baseSelect = () =>
    supabase
      .from("newvibes_products")
      .select(PRODUCT_SELECT_COLUMNS)
      .eq("status", "published")
      .lte("posted_at", nowIso)
      .is("admin_hidden_at", null)

  const baseCount = () =>
    supabase
      .from("newvibes_products")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .lte("posted_at", nowIso)
      .is("admin_hidden_at", null)

  const [
    todayRowsResult,
    thisMonthRowsResult,
    lastMonthRowsResult,
    olderRowsResult,
    todayCountResult,
    thisMonthCountResult,
    userResult,
  ] = await Promise.all([
    baseSelect()
      .gte("posted_at", dayStartIso)
      .order("upvote_count", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(HOME_SECTION_LIMITS.today),
    baseSelect()
      .gte("posted_at", thisMonthStartIso)
      .order("upvote_count", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(HOME_SECTION_LIMITS.thisMonth),
    baseSelect()
      .gte("posted_at", lastMonthStartIso)
      .lt("posted_at", thisMonthStartIso)
      .order("upvote_count", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(HOME_SECTION_LIMITS.lastMonth),
    baseSelect()
      .lt("posted_at", lastMonthStartIso)
      .order("upvote_count", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(HOME_SECTION_LIMITS.older),
    baseCount().gte("posted_at", dayStartIso),
    baseCount().gte("posted_at", thisMonthStartIso),
    supabase.auth.getUser(),
  ])

  const todayRows = (todayRowsResult.data ?? []) as ProductRow[]
  const thisMonthRows = (thisMonthRowsResult.data ?? []) as ProductRow[]
  const lastMonthRows = (lastMonthRowsResult.data ?? []) as ProductRow[]
  const olderRows = (olderRowsResult.data ?? []) as ProductRow[]

  /** 4 セクションを連結してから一括で profile を解決し、N+1 を避ける */
  const allRows = [...todayRows, ...thisMonthRows, ...lastMonthRows, ...olderRows]
  const { profilesById, mainAvatarById } = await resolveMakers(supabase, allRows)
  const toProducts = (rows: ProductRow[]) =>
    rows.map((r) => rowToHomeProduct(r, profilesById, mainAvatarById))

  let upvotedProductIds: string[] = []
  const viewerUserId = userResult.data?.user?.id ?? null
  let viewerHasProfile = false
  if (viewerUserId) {
    const [{ data: ups }, { data: viewerProfile }] = await Promise.all([
      supabase
        .from("newvibes_upvotes")
        .select("product_id")
        .eq("user_id", viewerUserId),
      supabase
        .from("newvibes_profiles")
        .select("id")
        .eq("id", viewerUserId)
        .maybeSingle(),
    ])
    if (ups) {
      upvotedProductIds = (ups as { product_id: string }[]).map((row) => row.product_id)
    }
    viewerHasProfile = Boolean(viewerProfile)
  }

  return {
    sections: {
      today: {
        products: toProducts(todayRows),
        totalCount: todayCountResult.count ?? todayRows.length,
      },
      thisMonth: {
        products: toProducts(thisMonthRows),
        totalCount: thisMonthCountResult.count ?? thisMonthRows.length,
      },
      lastMonth: {
        products: toProducts(lastMonthRows),
        totalCount: lastMonthRows.length,
      },
      older: {
        products: toProducts(olderRows),
        totalCount: olderRows.length,
      },
    },
    upvotedProductIds,
    viewer: {
      isAuthenticated: Boolean(viewerUserId),
      hasProfile: viewerHasProfile,
    },
  }
}

/** ----------------------------------------------------------
 *  「本日始まったプロダクトをすべて見る」全件取得（/fromhere/today 用）
 *  - 上限は安全のため 200 件で打ち切る（通常 200 件もホームに溜まらない想定）。
 * ---------------------------------------------------------- */
export async function fetchTodayAllProducts(): Promise<{
  products: HomeProduct[]
  totalCount: number
}> {
  return fetchProductsSince("today")
}

/** 「今月始まったプロダクトをすべて見る」全件取得（/fromhere/month 用） */
export async function fetchThisMonthAllProducts(): Promise<{
  products: HomeProduct[]
  totalCount: number
}> {
  return fetchProductsSince("thisMonth")
}

const PERIOD_PAGE_LIMIT = 200

async function fetchProductsSince(
  period: "today" | "thisMonth",
): Promise<{ products: HomeProduct[]; totalCount: number }> {
  const supabase = await getSupabase()
  const { dayStartIso, thisMonthStartIso } = getJstHomeBoundaries()
  const sinceIso = period === "today" ? dayStartIso : thisMonthStartIso
  /** 予約済み（未来分）はホーム同様にここでも除外する。 */
  const nowIso = new Date().toISOString()

  const [rowsResult, countResult] = await Promise.all([
    supabase
      .from("newvibes_products")
      .select(PRODUCT_SELECT_COLUMNS)
      .eq("status", "published")
      .gte("posted_at", sinceIso)
      .lte("posted_at", nowIso)
      .is("admin_hidden_at", null)
      .order("upvote_count", { ascending: false })
      .order("posted_at", { ascending: false })
      .limit(PERIOD_PAGE_LIMIT),
    supabase
      .from("newvibes_products")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("posted_at", sinceIso)
      .lte("posted_at", nowIso)
      .is("admin_hidden_at", null),
  ])

  const rows = (rowsResult.data ?? []) as ProductRow[]
  const { profilesById, mainAvatarById } = await resolveMakers(supabase, rows)
  return {
    products: rows.map((r) => rowToHomeProduct(r, profilesById, mainAvatarById)),
    totalCount: countResult.count ?? rows.length,
  }
}

/** ログイン中ユーザーの upvote 済み product ID を返す（/today, /month 用の補助） */
export async function fetchUpvotedProductIdsForViewer(): Promise<string[]> {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("newvibes_upvotes")
    .select("product_id")
    .eq("user_id", user.id)
  return (data ?? []).map((row: unknown) => (row as { product_id: string }).product_id)
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
