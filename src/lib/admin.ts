import type { SupabaseClient } from "@supabase/supabase-js"

type AdminProfile = {
  is_admin: boolean | null
}

export async function getIsAdminFromProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle<AdminProfile>()

  if (error) {
    return false
  }

  return Boolean(data?.is_admin)
}
