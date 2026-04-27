"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Action 等で set が失敗しうる。ミドルウェアのセッション更新に委ねる。
          }
        },
      },
    },
  )
}

/**
 * 買主が、完了承認待ち（`approval_pending`）の取引を完了にする（サーバー・セッション RLS 前提）
 */
export async function completeTransaction(transactionId: string) {
  if (!transactionId?.trim()) {
    throw new Error("transactionId is required")
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("ログインが必要です。")
  }

  const { data: row, error: loadError } = await supabase
    .from("transactions")
    .select("id, buyer_id, status")
    .eq("id", transactionId.trim())
    .maybeSingle()

  if (loadError) {
    const msg = [loadError.message, (loadError as { code?: string }).code, (loadError as { details?: string }).details]
      .filter(Boolean)
      .join(" ")
    throw new Error(msg || "取引の取得に失敗しました。")
  }
  if (!row) {
    throw new Error("取引が見つかりません。")
  }

  const tx = row as { buyer_id?: string; status?: string }
  if (String(tx.buyer_id) !== user.id) {
    throw new Error("条件不一致（すでに完了済み、または権限なし）")
  }
  if (String(tx.status) !== "approval_pending") {
    throw new Error("条件不一致（すでに完了済み、または権限なし）")
  }

  const nowIso = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "completed",
      completed_at: nowIso,
      auto_complete_at: null,
    })
    .eq("id", transactionId.trim())
    .eq("buyer_id", user.id)
    .eq("status", "approval_pending")
    .select("id")
    .maybeSingle()

  if (updateError) {
    const msg = [updateError.message, (updateError as { code?: string }).code, (updateError as { details?: string }).details]
      .filter(Boolean)
      .join(" ")
    throw new Error(msg || "取引の更新に失敗しました。")
  }
  if (!updated) {
    throw new Error("取引の更新に失敗しました。画面を更新して再度お試しください。")
  }

  return { success: true as const }
}
