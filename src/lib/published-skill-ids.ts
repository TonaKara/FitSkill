import { createClient } from "@supabase/supabase-js"

/**
 * サイトマップ等用。公開中スキルの id（文字列）一覧。
 * SERVICE_ROLE があればそれを優先（RLS 差分に強い）。なければ anon。
 */
export async function fetchPublishedSkillIds(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return []
  }
  const supabase = createClient(url, key)
  const { data, error } = await supabase.from("skills").select("id").eq("is_published", true)
  if (error) {
    console.warn("[sitemap] skills select failed:", error.message)
    return []
  }
  return (data ?? [])
    .map((row) => (row?.id != null ? String(row.id) : ""))
    .filter((id) => id.length > 0)
}
