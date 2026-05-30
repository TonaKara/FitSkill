import "server-only"

import { getIsAdminFromProfile } from "@/lib/admin"
import {
  requireActionUser,
  type ActionUserSession,
  type RequireActionUserResult,
} from "@/lib/supabase/action-auth"

/**
 * Server Action 用の「管理者ガード」。
 *
 * - 未ログイン → `unauthorized`
 * - 本体 `profiles.is_admin = true` でないユーザー → `forbidden`
 * - 通過した場合は `requireActionUser` と同じ `{ supabase, user }` を返す。
 *
 * 管理者判定は本体 `profiles.is_admin` を一次情報源とする。FromHere 側の
 * `newvibes_profiles` には触らない。
 */
export type RequireActionAdminResult =
  | { ok: true; session: ActionUserSession }
  | { ok: false; error: "unauthorized" | "forbidden" | "internal" }

export async function requireActionAdmin(
  accessToken?: string | null,
): Promise<RequireActionAdminResult> {
  const auth: RequireActionUserResult = await requireActionUser(accessToken)
  if (!auth.ok) {
    return { ok: false, error: "unauthorized" }
  }

  try {
    const isAdmin = await getIsAdminFromProfile(auth.session.supabase, auth.session.user.id)
    if (!isAdmin) {
      return { ok: false, error: "forbidden" }
    }
    return { ok: true, session: auth.session }
  } catch (error) {
    console.error("[requireActionAdmin] unexpected", error)
    return { ok: false, error: "internal" }
  }
}
