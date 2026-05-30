import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getIsAdminFromProfile } from "@/lib/admin"

/**
 * SSR / Route Handler 以外の Server Component から「現在のユーザーが管理者か」を
 * cookie だけで判定するためのユーティリティ。
 *
 * - 未ログインなら `false`。
 * - 本体 `profiles.is_admin = true` のときだけ `true`。
 * - 失敗時はサイレントに `false` を返す（UI 用の判定のため）。
 */
export async function detectIsFromHereAdmin(): Promise<boolean> {
  try {
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
                /* RSC で set 不可な場面は無視 */
              }
            })
          },
        },
      },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    return await getIsAdminFromProfile(supabase, user.id)
  } catch {
    return false
  }
}
