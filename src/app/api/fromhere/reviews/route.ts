import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  ADMIN_REVIEW_HOME_LIMIT,
  resolveIconUrl,
  type AdminReviewListItem,
} from "@/fromhere/_admin-reviews-data"

/** ----------------------------------------------------------
 *  GET /api/fromhere/reviews
 *  - 最新の公開済みレビュー一覧を返す。
 *  - クエリ:
 *      limit  既定 15、最大 50
 *  - 認証不要（誰でも閲覧可能）。
 * ---------------------------------------------------------- */

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(50, Math.floor(parsedLimit)))
    : ADMIN_REVIEW_HOME_LIMIT

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const { data, error } = await supabase
    .from("newvibes_admin_reviews")
    .select("id, slug, title, summary, icon_path, icon_url, status, published_at, created_at, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return NextResponse.json(
      { ok: false, error: "fetch_failed" },
      { status: 500 },
    )
  }

  const reviews: AdminReviewListItem[] = (data ?? []).map((row: unknown) => {
    const r = row as {
      id: string
      slug: string
      title: string
      summary: string
      icon_path: string | null
      icon_url: string | null
      status: string
      published_at: string | null
      created_at: string
      updated_at: string
    }
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      iconUrl: resolveIconUrl(r.icon_url, r.icon_path),
      status: r.status === "draft" ? "draft" : "published",
      publishedAt: r.published_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })

  return NextResponse.json({ ok: true, reviews }, { status: 200 })
}
