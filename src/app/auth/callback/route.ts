import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { sanitizeAuthNextPath } from "@/lib/auth-email-flow"
import { getAppBaseUrl } from "@/lib/site-seo"

function buildLoginRedirectUrl(origin: string, errorCode: string): string {
  const params = new URLSearchParams({ error: errorCode })
  return `${origin}/login?${params.toString()}`
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextPath = sanitizeAuthNextPath(requestUrl.searchParams.get("next"))
  const origin = getAppBaseUrl().replace(/\/$/, "")

  if (!code) {
    return NextResponse.redirect(buildLoginRedirectUrl(origin, "auth_callback"))
  }

  const redirectUrl = `${origin}${nextPath}`
  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(buildLoginRedirectUrl(origin, "auth_callback"))
  }

  return response
}
