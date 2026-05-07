import type { SupabaseClient } from "@supabase/supabase-js"

type BanProfile = {
  status: string | null
  is_banned: boolean | null
  is_admin: boolean | null
}

export async function getBanStatusFromProfile(supabase: SupabaseClient, userId: string): Promise<{
  isBanned: boolean
  isAdmin: boolean
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("status, is_banned, is_admin")
    .eq("id", userId)
    .maybeSingle<BanProfile>()

  if (error) {
    return { isBanned: false, isAdmin: false }
  }

  return {
    isBanned: (data?.status ?? "").trim() === "banned" || Boolean(data?.is_banned),
    isAdmin: Boolean(data?.is_admin),
  }
}
