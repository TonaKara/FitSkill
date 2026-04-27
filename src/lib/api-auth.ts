import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { cookies } from "next/headers"

type AuthedApiContext = {
  supabase: ReturnType<typeof createServerClient>
  user: User
}

/**
 * Route Handler 用の共通ログインガード。
 * 未ログイン時は 401 Response を返す。
 */
export async function requireApiUser(): Promise<
  { ok: true; context: AuthedApiContext } | { ok: false; response: Response }
> {
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
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { ok: true, context: { supabase, user } }
}
