import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { resolveFromHereAvatarUrl } from "@/fromhere/_avatar-url"
import {
  MAKERS_PAGE_SIZE,
  MAKERS_SORT_DEFAULT,
  type MakersSort,
} from "@/fromhere/_makers-config"

/** ----------------------------------------------------------
 *  /fromhere/makers ページ用のサーバー側データフェッチャ
 *
 *  - メーカー（profile を作成済みのユーザー）の一覧を取得し、
 *    投稿数と直近 7 日の累計 upvotes を集計する。
 *  - 集計はサーバー上で JS により実施する。MVP として "全 published products + 全 profiles" を
 *    取得して in-memory 集計する方針（〜数千件規模で十分動作する想定）。
 *  - 規模が大きくなった場合は materialized view / RPC へ置き換える。
 *
 *  注: ソート種別や URL パース等の **client/server 共有定数** は `_makers-config.ts` に分離してある。
 *      このファイルは `server-only` を含むためクライアントから import 不可。
 * ---------------------------------------------------------- */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** 一覧フェッチで参照する上限（取りすぎ防止 + SSR レスポンス時間の保護） */
const PROFILES_HARD_LIMIT = 5000
const PRODUCTS_HARD_LIMIT = 10000

export type MakerEntry = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  joinedAt: string
  totalPosts: number
  weeklyUpvotes: number
  /** 最後の投稿時刻（無投稿なら null） */
  lastPostedAt: string | null
}

export type MakersData = {
  makers: MakerEntry[]
  total: number
  page: number
  pageSize: number
  sort: MakersSort
  totalPages: number
}

/** ----------------------------------------------------------
 *  Supabase クライアント（cookies で session を読み出すため毎回生成）
 *  ※ 公開データのみ参照するため認証不要。
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

export async function fetchFromHereMakers({
  sort = MAKERS_SORT_DEFAULT,
  page = 1,
}: {
  sort?: MakersSort
  page?: number
}): Promise<MakersData> {
  const supabase = await getSupabase()

  // プロフィール（公開情報のみ）と公開済みプロダクトの集計用カラムを並列取得。
  const [profilesResult, productsResult] = await Promise.all([
    supabase
      .from("newvibes_profiles")
      .select("id, handle, display_name, avatar_path, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(PROFILES_HARD_LIMIT),
    supabase
      .from("newvibes_products")
      .select("maker_id, upvote_count, posted_at")
      .eq("status", "published")
      .lte("posted_at", new Date().toISOString())
      .is("admin_hidden_at", null)
      .limit(PRODUCTS_HARD_LIMIT),
  ])

  const profiles = (profilesResult.data ?? []) as ProfileRow[]
  const products = (productsResult.data ?? []) as ProductAggRow[]

  /**
   * 本体 `profiles.avatar_url` を一括取得し、メーカー一覧でも統一して表示する。
   * profile 行が多い場合は in() 句で 1 クエリにまとめる。
   */
  const profileIds = profiles.map((p) => p.id)
  const mainAvatarById = new Map<string, string | null>()
  if (profileIds.length > 0) {
    const { data: mainProfiles } = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", profileIds)
    if (mainProfiles) {
      for (const row of mainProfiles as { id: string; avatar_url: string | null }[]) {
        mainAvatarById.set(row.id, row.avatar_url ?? null)
      }
    }
  }

  const sinceMs = Date.now() - SEVEN_DAYS_MS
  type Stats = { totalPosts: number; weeklyUpvotes: number; lastPostedAt: string | null }
  const statsById = new Map<string, Stats>()

  for (const row of products) {
    if (!row.maker_id) {
      continue
    }
    const existing = statsById.get(row.maker_id) ?? {
      totalPosts: 0,
      weeklyUpvotes: 0,
      lastPostedAt: null,
    }
    existing.totalPosts += 1
    const postedMs = new Date(row.posted_at).getTime()
    if (Number.isFinite(postedMs) && postedMs >= sinceMs) {
      existing.weeklyUpvotes += typeof row.upvote_count === "number" ? row.upvote_count : 0
    }
    if (
      !existing.lastPostedAt ||
      new Date(row.posted_at).getTime() > new Date(existing.lastPostedAt).getTime()
    ) {
      existing.lastPostedAt = row.posted_at
    }
    statsById.set(row.maker_id, existing)
  }

  const makers: MakerEntry[] = profiles.map((profile) => {
    const stats = statsById.get(profile.id)
    return {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.display_name,
      avatarUrl: resolveFromHereAvatarUrl({
        mainAvatarUrl: mainAvatarById.get(profile.id) ?? null,
        avatarPath: profile.avatar_path,
        avatarUrl: profile.avatar_url,
      }),
      joinedAt: profile.created_at,
      totalPosts: stats?.totalPosts ?? 0,
      weeklyUpvotes: stats?.weeklyUpvotes ?? 0,
      lastPostedAt: stats?.lastPostedAt ?? null,
    }
  })

  // ソート
  const sorted = sortMakers(makers, sort)
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / MAKERS_PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * MAKERS_PAGE_SIZE
  const paged = sorted.slice(start, start + MAKERS_PAGE_SIZE)

  return {
    makers: paged,
    total,
    page: safePage,
    pageSize: MAKERS_PAGE_SIZE,
    sort,
    totalPages,
  }
}

function sortMakers(list: MakerEntry[], sort: MakersSort): MakerEntry[] {
  const arr = [...list]
  if (sort === "top") {
    arr.sort(
      (a, b) =>
        b.weeklyUpvotes - a.weeklyUpvotes ||
        b.totalPosts - a.totalPosts ||
        (b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : 0) -
          (a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : 0),
    )
  } else if (sort === "posts") {
    arr.sort(
      (a, b) =>
        b.totalPosts - a.totalPosts ||
        b.weeklyUpvotes - a.weeklyUpvotes ||
        (b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : 0) -
          (a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : 0),
    )
  } else {
    // recent: 最後の投稿が新しい順。無投稿は最後尾
    arr.sort((a, b) => {
      const aTs = a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : -1
      const bTs = b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : -1
      return bTs - aTs
    })
  }
  return arr
}

type ProfileRow = {
  id: string
  handle: string
  display_name: string
  avatar_path: string | null
  avatar_url: string | null
  created_at: string
}

type ProductAggRow = {
  maker_id: string
  upvote_count: number | null
  posted_at: string
}
