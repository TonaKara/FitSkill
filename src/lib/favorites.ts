import type { SupabaseClient } from "@supabase/supabase-js"

export async function getFavoriteCountAndMine(
  supabase: SupabaseClient,
  skillId: string,
): Promise<{ count: number; favorited: boolean }> {
  const [{ data: countRow, error: countError }, authResult] = await Promise.all([
    supabase
      .from("skill_favorite_counts")
      .select("favorites_count")
      .eq("skill_id", skillId)
      .maybeSingle<{ favorites_count: number }>(),
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

  return { count: Math.max(0, Number(countRow?.favorites_count ?? 0)), favorited }
}
