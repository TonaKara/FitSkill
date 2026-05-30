import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  computeNextStreak,
  getCurrentLoginStreakBadge,
  summarizeStreak,
  toJstDateString,
} from "@/fromhere/_login-streak"

/**
 * POST /api/fromhere/login-streak/touch
 *
 * - 認証済みユーザーの今日（JST）のアクセスを 1 度だけ記録する。
 * - 同日中の再アクセスは現状値をそのまま返し、書き込みは行わない。
 * - 戻り値:
 *     {
 *       currentStreak: number,
 *       longestStreak: number,
 *       lastLoginDate: string,
 *       currentBadge: string | null,
 *       changed: boolean
 *     }
 */
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          /**
           * セッション更新時にレスポンスへ Set-Cookie を伝搬したいが、
           * Route Handler では Cookie API が読み取り専用のため、
           * 例外を握りつぶす形で no-op にしておく（書き込みエラーは無視）。
           */
          try {
            for (const c of cookiesToSet) {
              cookieStore.set(c)
            }
          } catch {
            /* no-op: Route Handler では set 不可なケースがある */
          }
        },
      },
    },
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 })
  }

  const todayJst = toJstDateString(new Date())
  if (!todayJst) {
    return Response.json({ error: "internal" }, { status: 500 })
  }

  const { data: existing, error: selectError } = await supabase
    .from("newvibes_login_streaks")
    .select("current_streak, longest_streak, last_login_date")
    .eq("user_id", user.id)
    .maybeSingle()

  if (selectError) {
    return Response.json({ error: "internal" }, { status: 500 })
  }

  const prev = existing
    ? {
        currentStreak: Number(existing.current_streak) || 0,
        longestStreak: Number(existing.longest_streak) || 0,
        lastLoginDate: String(existing.last_login_date),
      }
    : null

  const next = computeNextStreak(prev, todayJst)

  if (!next.changed) {
    return Response.json({
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastLoginDate: next.lastLoginDate,
      currentBadge: getCurrentLoginStreakBadge(next.currentStreak),
      changed: false,
    })
  }

  const { error: upsertError } = await supabase.from("newvibes_login_streaks").upsert(
    {
      user_id: user.id,
      current_streak: next.currentStreak,
      longest_streak: next.longestStreak,
      last_login_date: next.lastLoginDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (upsertError) {
    return Response.json({ error: "internal" }, { status: 500 })
  }

  const summary = summarizeStreak({
    current_streak: next.currentStreak,
    longest_streak: next.longestStreak,
    last_login_date: next.lastLoginDate,
  })

  return Response.json({
    currentStreak: summary.currentStreak,
    longestStreak: summary.longestStreak,
    lastLoginDate: summary.lastLoginDate,
    currentBadge: summary.currentBadge,
    changed: true,
  })
}
