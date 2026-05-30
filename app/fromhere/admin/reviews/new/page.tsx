import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getIsAdminFromProfile } from "@/lib/admin"
import { AdminReviewForm } from "@/fromhere/admin/reviews/AdminReviewForm"

export const dynamic = "force-dynamic"

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

  return (
    <AdminReviewForm
      mode="create"
      initial={{
        title: "",
        summary: "",
        body: "",
        iconPath: null,
        iconUrl: null,
        status: "published",
      }}
    />
  )
}
