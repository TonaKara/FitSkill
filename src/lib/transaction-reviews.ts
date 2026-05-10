import type { SupabaseClient } from "@supabase/supabase-js"
import { createTransactionNotification, NOTIFICATION_TYPE } from "@/lib/transaction-notifications"

export type TransactionReviewRow = {
  id: string
  transaction_id: number
  sender_id: string
  receiver_id: string
  stars: number
  comment: string | null
  created_at: string
}

type RatingsRow = {
  id: string
  transaction_id: number
  sender_id: string
  receiver_id: string
  rating: number
  comment: string | null
  created_at: string
}

function normalizeTransactionId(transactionId: string): number | string {
  const trimmed = transactionId.trim()
  if (!trimmed) {
    return transactionId
  }
  const n = Number(trimmed)
  if (Number.isFinite(n) && String(n) === trimmed) {
    return n
  }
  return transactionId
}

function mapRatingRowToReviewRow(row: RatingsRow): TransactionReviewRow {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    stars: row.rating,
    comment: row.comment,
    created_at: row.created_at,
  }
}

export async function fetchMyTransactionReview(
  supabase: SupabaseClient,
  params: { transactionId: string; reviewerId: string },
): Promise<TransactionReviewRow | null> {
  const txId = normalizeTransactionId(params.transactionId)
  const { data, error } = await supabase
    .from("ratings")
    .select("id, transaction_id, sender_id, receiver_id, rating, comment, created_at")
    .eq("transaction_id", txId)
    .eq("sender_id", params.reviewerId)
    .maybeSingle()

  if (error) {
    console.error("[fetchMyTransactionReview]", error)
    return null
  }

  if (!data) {
    return null
  }

  return mapRatingRowToReviewRow(data as RatingsRow)
}

export async function submitTransactionReview(
  supabase: SupabaseClient,
  params: {
    transactionId: string
    reviewerId: string
    revieweeId: string
    stars: number
    comment: string | null
  },
): Promise<{ data: TransactionReviewRow | null; error: { message: string } | null }> {
  const txId = normalizeTransactionId(params.transactionId)
  const { data, error } = await supabase
    .from("ratings")
    .insert({
      transaction_id: txId,
      sender_id: params.reviewerId,
      receiver_id: params.revieweeId,
      rating: params.stars,
      comment: params.comment?.trim() || null,
    })
    .select("id, transaction_id, sender_id, receiver_id, rating, comment, created_at")
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    const message =
      code === "23505"
        ? "この取引にはすでに評価を送信済みです。"
        : error.message
    return { data: null, error: { message } }
  }

  const txIdForNotify = typeof txId === "number" ? txId : Number(String(params.transactionId).trim())
  if (Number.isFinite(txIdForNotify)) {
    const { error: nErr } = await createTransactionNotification(supabase, {
      recipient_id: params.revieweeId,
      type: NOTIFICATION_TYPE.review,
      content: "取引の相手から評価が届いています。",
    })
    if (nErr) {
      console.error("[submitTransactionReview] createTransactionNotification failed", nErr)
    }
  }

  // Step 2: 同一 receiver_id の全評価を取得して再計算
  const { data: ratingRows, error: ratingsError } = await supabase
    .from("ratings")
    .select("rating")
    .eq("receiver_id", params.revieweeId)

  if (!ratingsError && ratingRows) {
    const ratings = (ratingRows as Array<{ rating: number | null }>)
      .map((row) => Number(row.rating))
      .filter((value) => Number.isFinite(value))

    const reviewCount = ratings.length
    const ratingAvg =
      reviewCount > 0 ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / reviewCount) * 100) / 100 : null

    // Step 3: 計算結果を profiles に反映
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        rating_avg: ratingAvg,
        review_count: reviewCount,
      })
      .eq("id", params.revieweeId)

    if (profileUpdateError) {
      console.error("[submitTransactionReview] profiles update failed; fallback to rpc", {
        revieweeId: params.revieweeId,
        fields: {
          rating_avg: ratingAvg,
          review_count: reviewCount,
        },
        message: profileUpdateError.message,
        code: (profileUpdateError as { code?: string }).code ?? null,
        details: (profileUpdateError as { details?: string }).details ?? null,
        hint: (profileUpdateError as { hint?: string }).hint ?? null,
      })
    }
  } else {
    console.warn("[submitTransactionReview] ratings aggregate query failed; fallback to rpc", ratingsError)
  }

  // フォールバック: DB関数で再集計を強制（RLS/権限差分があっても最終値を整える）
  const { error: refreshError } = await supabase.rpc("refresh_profile_review_stats", {
    p_user_id: params.revieweeId,
  })
  if (refreshError) {
    return {
      data: null,
      error: { message: refreshError.message || "プロフィール評価の再計算に失敗しました。" },
    }
  }

  return { data: mapRatingRowToReviewRow(data as RatingsRow), error: null }
}
