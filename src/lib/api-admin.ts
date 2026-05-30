import "server-only"

import type { User } from "@supabase/supabase-js"

import { requireApiUser } from "@/lib/api-auth"
import { getIsAdminFromProfile } from "@/lib/admin"

type AuthedApiContext = Awaited<ReturnType<typeof requireApiUser>>

/**
 * Route Handler 用の「管理者ガード」。
 *
 * - 未ログイン → 401
 * - 本体 `profiles.is_admin = true` でないユーザー → 403
 * - 通過した場合は `requireApiUser` と同じ shape の `{ supabase, user }` を返す。
 *
 * 本体 GritVib 側と FromHere 側で「管理者」を共通化するため、`profiles.is_admin` を
 * 一次情報源とする。FromHere 側の `newvibes_profiles` には触らない。
 */
export async function requireApiAdmin(): Promise<
  | { ok: true; context: { supabase: Extract<AuthedApiContext, { ok: true }>["context"]["supabase"]; user: User } }
  | { ok: false; response: Response }
> {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return auth
  }
  const { supabase, user } = auth.context
  const isAdmin = await getIsAdminFromProfile(supabase, user.id)
  if (!isAdmin) {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { ok: true, context: { supabase, user } }
}
