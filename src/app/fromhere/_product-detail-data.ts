import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { FromHereCategory } from "@/fromhere/_product-validation"
import {
  FROMHERE_APP_ICONS_BUCKET,
  FROMHERE_SCREENSHOTS_BUCKET,
} from "@/fromhere/_product-validation"
import { resolveFromHereAvatarUrl } from "@/fromhere/_avatar-url"

/** ----------------------------------------------------------
 *  プロダクト詳細ページに必要なデータ型
 * ---------------------------------------------------------- */

export type ProductDetailData = {
  product: ProductDetail
  maker: ProductDetailMaker
  /** 同じメーカーが投稿した他の published プロダクト（最大 3 件、自分を除外） */
  moreFromMaker: ProductDetailRelated[]
  /** 初期表示用のコメント（古い順、最大 50 件） */
  comments: ProductComment[]
  viewer: {
    isAuthenticated: boolean
    hasProfile: boolean
    isOwner: boolean
    /** 当該プロダクトに対して upvote 済みかどうか */
    hasUpvoted: boolean
  }
}

export type ProductComment = {
  id: string
  body: string
  createdAt: string
  parentId: string | null
  author: {
    id: string
    handle: string
    displayName: string
    avatarUrl: string | null
  }
  isOwn: boolean
}

export type ProductDetail = {
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
  status: "draft" | "published"
}

export type ProductDetailMaker = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
}

export type ProductDetailRelated = {
  id: string
  slug: string
  title: string
  tagline: string
  category: FromHereCategory
  appIconUrl: string | null
  upvoteCount: number
}

/** ----------------------------------------------------------
 *  Supabase client（Cookie 共有 / 読み取り専用）
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
 *  slug パラメータの正規化
 *  - URL から渡される slug は `_slug.ts` の制約と同じ（小文字英数字 + `-`）。
 *  - 制約に合致しない場合は null を返し、呼び出し側で notFound() させる。
 * ---------------------------------------------------------- */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/

export function normalizeProductSlug(raw: string): string | null {
  if (typeof raw !== "string") {
    return null
  }
  let value
  try {
    value = decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return null
  }
  if (!SLUG_PATTERN.test(value)) {
    return null
  }
  return value
}

/** ----------------------------------------------------------
 *  詳細取得のエントリポイント
 *  - 公開済みプロダクトのみ表示。所有者なら draft も閲覧可能。
 *  - 関連プロダクトは同じメーカーの最新 3 件。
 * ---------------------------------------------------------- */
const RELATED_LIMIT = 3
const COMMENTS_LIMIT = 50

export async function fetchProductDetail(slugInput: string): Promise<ProductDetailData | null> {
  const slug = normalizeProductSlug(slugInput)
  if (!slug) {
    return null
  }
  const supabase = await getSupabase()

  const { data: productRow, error: productErr } = await supabase
    .from("newvibes_products")
    .select(
      "id, slug, title, tagline, description, category, tags, product_url, app_icon_path, screenshot_path, upvote_count, comment_count, posted_at, status, maker_id, admin_hidden_at",
    )
    .eq("slug", slug)
    .maybeSingle()

  if (productErr || !productRow) {
    return null
  }

  const row = productRow as ProductRow

  const { data: userData } = await supabase.auth.getUser()
  const viewerUserId = userData?.user?.id ?? null
  const isOwner = Boolean(viewerUserId && viewerUserId === row.maker_id)

  // draft はオーナーのみ閲覧可能
  if (row.status === "draft" && !isOwner) {
    return null
  }
  /**
   * 公開予約済み（`posted_at` が未来）はオーナーのみ閲覧可能。
   * - 一般ユーザーには 404 を返して、公開日 0:00 になるまでは存在を露出しない。
   */
  if (
    row.status === "published" &&
    new Date(row.posted_at).getTime() > Date.now() &&
    !isOwner
  ) {
    return null
  }
  /**
   * 運営により非公開化されたプロダクト (`admin_hidden_at != null`) は、オーナーには
   * 引き続き詳細ページが見える（運営による非公開状態を本人だけは把握できる）。
   * オーナー以外には 404 を返す。
   */
  if (row.admin_hidden_at != null && !isOwner) {
    return null
  }

  const [makerResult, moreResult, upvoteResult, viewerProfileResult, commentsResult] = await Promise.all([
    supabase
      .from("newvibes_profiles")
      .select("id, handle, display_name, bio, avatar_url, avatar_path")
      .eq("id", row.maker_id)
      .maybeSingle(),
    supabase
      .from("newvibes_products")
      .select("id, slug, title, tagline, category, app_icon_path, upvote_count")
      .eq("maker_id", row.maker_id)
      .eq("status", "published")
      .lte("posted_at", new Date().toISOString())
      .is("admin_hidden_at", null)
      .neq("id", row.id)
      .order("posted_at", { ascending: false })
      .limit(RELATED_LIMIT),
    viewerUserId
      ? supabase
          .from("newvibes_upvotes")
          .select("product_id")
          .eq("product_id", row.id)
          .eq("user_id", viewerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    viewerUserId
      ? supabase
          .from("newvibes_profiles")
          .select("id")
          .eq("id", viewerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    supabase
      .from("newvibes_comments")
      .select("id, body, created_at, parent_id, user_id")
      .eq("product_id", row.id)
      .order("created_at", { ascending: true })
      .limit(COMMENTS_LIMIT),
  ])

  const makerRow = (makerResult.data ?? null) as MakerRow | null
  if (!makerRow) {
    return null
  }

  /** 本体 `profiles.avatar_url` を取得して FromHere でも統一表示する */
  const { data: makerMainProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", makerRow.id)
    .maybeSingle()
  const makerMainAvatarUrl =
    makerMainProfile && typeof (makerMainProfile as { avatar_url?: unknown }).avatar_url === "string"
      ? ((makerMainProfile as { avatar_url: string }).avatar_url ?? null)
      : null

  const product: ProductDetail = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description ?? null,
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
  }

  const maker: ProductDetailMaker = {
    id: makerRow.id,
    handle: makerRow.handle,
    displayName: makerRow.display_name,
    bio: makerRow.bio ?? null,
    avatarUrl: resolveFromHereAvatarUrl({
      mainAvatarUrl: makerMainAvatarUrl,
      avatarPath: makerRow.avatar_path,
      avatarUrl: makerRow.avatar_url,
    }),
  }

  const moreFromMaker: ProductDetailRelated[] = ((moreResult.data ?? []) as RelatedRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    category: r.category as FromHereCategory,
    appIconUrl: r.app_icon_path ? buildPublicUrl(FROMHERE_APP_ICONS_BUCKET, r.app_icon_path) : null,
    upvoteCount: typeof r.upvote_count === "number" ? r.upvote_count : 0,
  }))

  /**
   * コメント本体は 1 クエリ。author 情報は別途まとめて取得して in-memory で merge する。
   * - 投稿者プロフィールが存在しないコメントは UI で「不明」と表示する。
   * - RLS で公開済みのみ取得される（DB トリガーで comment_count も整合）。
   */
  const commentRows = (commentsResult.data ?? []) as CommentRow[]
  const commentAuthorIds = Array.from(new Set(commentRows.map((c) => c.user_id))).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  )
  const authorMap = new Map<string, MakerRow>()
  const authorMainAvatarMap = new Map<string, string | null>()
  if (commentAuthorIds.length > 0) {
    const [{ data: authors }, { data: mainAuthors }] = await Promise.all([
      supabase
        .from("newvibes_profiles")
        .select("id, handle, display_name, bio, avatar_url, avatar_path")
        .in("id", commentAuthorIds),
      supabase.from("profiles").select("id, avatar_url").in("id", commentAuthorIds),
    ])
    for (const a of (authors ?? []) as MakerRow[]) {
      authorMap.set(a.id, a)
    }
    for (const row of (mainAuthors ?? []) as { id: string; avatar_url: string | null }[]) {
      authorMainAvatarMap.set(row.id, row.avatar_url ?? null)
    }
  }
  const comments: ProductComment[] = commentRows.map((c) => {
    const author = authorMap.get(c.user_id)
    return {
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      parentId: (c.parent_id as string | null) ?? null,
      author: {
        id: c.user_id,
        handle: author?.handle ?? "",
        displayName: author?.display_name ?? "",
        avatarUrl: resolveFromHereAvatarUrl({
          mainAvatarUrl: authorMainAvatarMap.get(c.user_id) ?? null,
          avatarPath: author?.avatar_path,
          avatarUrl: author?.avatar_url,
        }),
      },
      isOwn: Boolean(viewerUserId && viewerUserId === c.user_id),
    }
  })

  return {
    product,
    maker,
    moreFromMaker,
    comments,
    viewer: {
      isAuthenticated: Boolean(viewerUserId),
      hasProfile: Boolean(viewerProfileResult.data),
      isOwner,
      hasUpvoted: Boolean(upvoteResult.data),
    },
  }
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
 *  内部行型
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
  status: string
  maker_id: string
  admin_hidden_at: string | null
}

type MakerRow = {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  avatar_path: string | null
}

type RelatedRow = {
  id: string
  slug: string
  title: string
  tagline: string
  category: string
  app_icon_path: string | null
  upvote_count: number
}

type CommentRow = {
  id: string
  body: string
  created_at: string
  parent_id: string | null
  user_id: string
}
