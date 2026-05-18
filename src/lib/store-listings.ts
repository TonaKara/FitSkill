import type { SupabaseClient } from "@supabase/supabase-js"

export type StoreListing = {
  id: string
  title: string
  category: string | null
  price: number
  created_at: string | null
  is_published: boolean | null
  admin_publish_locked: boolean | null
  thumbnail_url: string | null
}

export type StoreListingFilter = "published" | "draft" | "all"

const LISTING_SELECT =
  "id, title, category, price, created_at, is_published, admin_publish_locked, thumbnail_url"

export async function fetchStoreListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ listings: StoreListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from("skills")
    .select(LISTING_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return { listings: [], error: "出品商品の取得に失敗しました。" }
  }

  return { listings: (data ?? []) as StoreListing[], error: null }
}

export function filterStoreListings(listings: StoreListing[], filter: StoreListingFilter): StoreListing[] {
  if (filter === "published") {
    return listings.filter((item) => item.is_published === true)
  }
  if (filter === "draft") {
    return listings.filter((item) => item.is_published !== true)
  }
  return listings
}
