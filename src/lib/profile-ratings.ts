import type { SupabaseClient } from "@supabase/supabase-js"

type ProfileRatingRow = {
  id: string
  sender_id: string
  rating: number
  comment: string | null
  created_at: string
}

type SenderProfileRow = {
  id: string
  display_name: string | null
}

export type ProfileRatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>

export type ProfileRatingComment = {
  id: string
  senderId: string
  senderName: string
  rating: number
  comment: string
  createdAt: string
}

export type ProfileRatingData = {
  distribution: ProfileRatingDistribution
  comments: ProfileRatingComment[]
}

function createEmptyDistribution(): ProfileRatingDistribution {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
}

export async function fetchProfileRatingData(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRatingData> {
  const empty: ProfileRatingData = {
    distribution: createEmptyDistribution(),
    comments: [],
  }

  if (!userId) {
    return empty
  }

  const { data, error } = await supabase
    .from("ratings")
    .select("id, sender_id, rating, comment, created_at")
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false })

  if (error || !data) {
    if (error) {
      console.error("[fetchProfileRatingData]", error)
    }
    return empty
  }

  const distribution = createEmptyDistribution()
  const ratingRows = data as ProfileRatingRow[]
  for (const row of ratingRows) {
    const rating = Math.floor(Number(row.rating)) as 1 | 2 | 3 | 4 | 5
    if (rating >= 1 && rating <= 5) {
      distribution[rating] += 1
    }
  }

  const commentRows = ratingRows.filter((row) => typeof row.comment === "string" && row.comment.trim().length > 0)
  if (commentRows.length === 0) {
    return { distribution, comments: [] }
  }

  const senderIds = [...new Set(commentRows.map((row) => row.sender_id))]
  const senderNameMap = new Map<string, string>()

  if (senderIds.length > 0) {
    const { data: senderProfiles, error: senderProfilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", senderIds)

    if (senderProfilesError) {
      console.error("[fetchProfileRatingData:profiles]", senderProfilesError)
    } else {
      for (const row of (senderProfiles ?? []) as SenderProfileRow[]) {
        senderNameMap.set(row.id, row.display_name?.trim() || "ユーザー")
      }
    }
  }

  const comments: ProfileRatingComment[] = commentRows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: senderNameMap.get(row.sender_id) ?? "ユーザー",
    rating: Math.max(1, Math.min(5, Math.floor(Number(row.rating)))),
    comment: row.comment?.trim() ?? "",
    createdAt: row.created_at,
  }))

  return {
    distribution,
    comments,
  }
}
