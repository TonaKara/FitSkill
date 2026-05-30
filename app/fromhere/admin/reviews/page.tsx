import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getIsAdminFromProfile } from "@/lib/admin"
import { fetchAdminReviewsForAdmin } from "@/fromhere/_admin-reviews-data"
import { AdminReviewsListClient } from "@/fromhere/admin/reviews/AdminReviewsListClient"

export const dynamic = "force-dynamic"

/**
 * 運営レビュー管理: 一覧ページ。
 *
 * - 未ログイン → /fromhere/signin
 * - 非管理者 → /fromhere（黙ってトップへ）
 * - 管理者 → 全レビューを最新作成順で 200 件まで表示
 */
export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              /* RSC 内では cookie 書き戻し不可な場面があるため無視 */
            }
          })
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/fromhere/signin")
  }
  const isAdmin = await getIsAdminFromProfile(supabase, user.id)
  if (!isAdmin) {
    redirect("/fromhere")
  }

  const reviews = await fetchAdminReviewsForAdmin()
  return <AdminReviewsListClient initialReviews={reviews} />
}
