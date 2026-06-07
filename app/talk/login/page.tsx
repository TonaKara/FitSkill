import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { LoginPage } from "@/talk/_login"
import { resolveGritvibPostAuthPath } from "@/lib/talk/post-auth-redirect"
import { talkPageMetadata } from "@/lib/talk/page-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return talkPageMetadata("login", "/talk/login")
}

export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect(await resolveGritvibPostAuthPath(supabase, user.id))
  }

  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
