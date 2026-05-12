import "server-only"

import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE } from "@/lib/stripe-payout-error-notice"

export type ActionUserSession = {
  supabase: SupabaseClient
  user: User
}

export type RequireActionUserResult =
  | { ok: true; session: ActionUserSession }
  | { ok: false; error: string }

function createCookieSupabaseClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )
}

function createSupabaseClientForAccessToken(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  )
}

/** Server Action 用。Cookie セッションが無い場合はクライアントから渡した access token を検証する。 */
export async function requireActionUser(accessToken?: string | null): Promise<RequireActionUserResult> {
  const cookieStore = await cookies()
  const cookieSupabase = createCookieSupabaseClient(cookieStore)
  const {
    data: { user: cookieUser },
  } = await cookieSupabase.auth.getUser()

  if (cookieUser) {
    return { ok: true, session: { supabase: cookieSupabase, user: cookieUser } }
  }

  const normalizedAccessToken = accessToken?.trim() ?? ""
  if (!normalizedAccessToken) {
    return { ok: false, error: STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE }
  }

  const {
    data: { user: tokenUser },
    error: tokenUserError,
  } = await cookieSupabase.auth.getUser(normalizedAccessToken)

  if (tokenUserError || !tokenUser) {
    return { ok: false, error: STRIPE_PAYOUT_SESSION_REQUIRED_MESSAGE }
  }

  return {
    ok: true,
    session: {
      user: tokenUser,
      supabase: createSupabaseClientForAccessToken(normalizedAccessToken),
    },
  }
}
