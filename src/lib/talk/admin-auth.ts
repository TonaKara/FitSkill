import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { requireActionUser } from "@/lib/supabase/action-auth"

/**
 * GritVib 管理画面用の認可ヘルパー。
 *
 *   - 通常の `requireActionUser` でログインしているか確認
 *   - 続けて `profiles.is_admin = true` を確認
 *
 * Server Action / Server Component の冒頭で呼ぶ。
 */

export type GritvibAdminSession = {
  supabase: SupabaseClient
  user: User
}

export type RequireGritvibAdminResult =
  | { ok: true; session: GritvibAdminSession }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "internal" }

export async function requireGritvibAdminUser(): Promise<RequireGritvibAdminResult> {
  const sessionResult = await requireActionUser()
  if (!sessionResult.ok) {
    return { ok: false, reason: "unauthenticated" }
  }
  const { supabase, user } = sessionResult.session

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[talk/admin] read profiles failed", error)
    return { ok: false, reason: "internal" }
  }
  if (!data?.is_admin) {
    return { ok: false, reason: "forbidden" }
  }
  return { ok: true, session: { supabase, user } }
}
