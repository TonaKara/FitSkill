import type { SupabaseClient } from "@supabase/supabase-js"

export async function ensureAuthenticated(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    throw new Error("AUTH_REQUIRED")
  }
}
