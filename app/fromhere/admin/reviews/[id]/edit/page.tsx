import { notFound, redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getIsAdminFromProfile } from "@/lib/admin"
import { AdminReviewForm } from "@/fromhere/admin/reviews/AdminReviewForm"
import { fetchAdminReviewByIdForAdmin } from "@/fromhere/_admin-reviews-data"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
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
              /* noop */
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

  const review = await fetchAdminReviewByIdForAdmin(id)
  if (!review) {
    notFound()
  }

  /**
   * `fetchAdminReviewByIdForAdmin` の戻り値には `iconPath` フィールドが
   * 直接含まれないため、別途 GET API と同じ仕様で 1 度だけ DB 再 SELECT し
   * iconPath を取り出す。
   */
  const { data: row } = await supabase
    .from("newvibes_admin_reviews")
    .select("icon_path")
    .eq("id", id)
    .maybeSingle()
  const iconPath = (row && (row.icon_path as string | null)) ?? null

  return (
    <AdminReviewForm
      mode="edit"
      initial={{
        id: review.id,
        title: review.title,
        summary: review.summary,
        body: review.body,
        iconPath,
        iconUrl: review.iconUrl,
        status: review.status,
      }}
    />
  )
}
