import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import {
  GRITVIB_LOGIN_PATH,
  resolveGritvibPostAuthPath,
} from "@/lib/talk/post-auth-redirect"

/**
 * `/talk/home` は GritVib のシンプル化に伴い廃止。
 * ログイン状態に応じてチャット・管理画面・オンボードへ転送する。
 */
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
  if (!user) {
    redirect(GRITVIB_LOGIN_PATH)
  }

  redirect(await resolveGritvibPostAuthPath(supabase, user.id))
}
