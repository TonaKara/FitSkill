import type { SupabaseClient } from "@supabase/supabase-js"

export async function getFavoriteCountAndMine(
  supabase: SupabaseClient,
  skillId: string,
): Promise<{ count: number; favorited: boolean }> {
  const [{ count, error: countError }, authResult] = await Promise.all([
    supabase.from("favorites").select("*", { count: "exact", head: true }).eq("skill_id", skillId),
    supabase.auth.getUser(),
  ])

  if (countError) {
    return { count: 0, favorited: false }
  }

  const user = authResult.data.user
  let favorited = false
  if (user) {
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("skill_id", skillId)
      .eq("user_id", user.id)
      .maybeSingle()
    favorited = Boolean(data)
  }

  return { count: count ?? 0, favorited }
}
