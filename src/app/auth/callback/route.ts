import { createServerClient } from "@supabase/ssr"
import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { sanitizeAuthNextPath } from "@/lib/auth-email-flow"
import { getAppBaseUrl } from "@/lib/site-seo"

type AuthCallbackFailureReason = "missing" | "session_context" | "exchange_failed" | "otp_failed"

function buildLoginRedirectUrl(origin: string, reason: AuthCallbackFailureReason): string {
  const params = new URLSearchParams({
    error: "auth_callback",
    reason,
  })
  return `${origin}/login?${params.toString()}`
}

function isLikelySessionContextError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("code verifier") ||
    normalized.includes("pkce") ||
    normalized.includes("both auth code and code verifier")
  )
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null
  const nextPath = sanitizeAuthNextPath(requestUrl.searchParams.get("next"))
  const origin = getAppBaseUrl().replace(/\/$/, "")
  const redirectUrl = `${origin}${nextPath}`

  const createSupabase = (response: NextResponse) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )

  if (tokenHash && type) {
    const response = NextResponse.redirect(redirectUrl)
    const supabase = createSupabase(response)
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      return response
    }
    return NextResponse.redirect(buildLoginRedirectUrl(origin, "otp_failed"))
  }

  if (!code) {
    return NextResponse.redirect(buildLoginRedirectUrl(origin, "missing"))
  }

  const response = NextResponse.redirect(redirectUrl)
  const supabase = createSupabase(response)
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const reason: AuthCallbackFailureReason = isLikelySessionContextError(error.message)
      ? "session_context"
      : "exchange_failed"
    return NextResponse.redirect(buildLoginRedirectUrl(origin, reason))
  }

  return response
}
