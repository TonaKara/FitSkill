import { createClient } from "@supabase/supabase-js"

function isMissingBannedColumnError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return normalized.includes("is_banned") && (normalized.includes("could not find") || normalized.includes("does not exist"))
}

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
  const primaryQuery = await supabase
    .from("skills")
    .select("id, profiles(is_banned)")
    .eq("is_published", true)
  let dataRows: unknown[] | null = (primaryQuery.data as unknown[] | null) ?? null
  let queryError = primaryQuery.error
  if (queryError && isMissingBannedColumnError(queryError.message)) {
    const fallbackQuery = await supabase.from("skills").select("id").eq("is_published", true)
    dataRows = (fallbackQuery.data as unknown[] | null) ?? null
    queryError = fallbackQuery.error
  }
  if (queryError) {
    console.warn("[sitemap] skills select failed:", queryError.message)
    return []
  }
  return (dataRows ?? [])
    .filter((row) => {
      const profile = (
        row as {
          profiles?: { is_banned?: boolean | null } | Array<{ is_banned?: boolean | null }> | null
        }
      ).profiles
      const isBanned = Array.isArray(profile) ? profile[0]?.is_banned === true : profile?.is_banned === true
      return !isBanned
    })
    .map((row) => {
      const rec = row as { id?: unknown }
      return rec.id != null ? String(rec.id) : ""
    })
    .filter((id) => id.length > 0)
}
