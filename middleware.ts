import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { shouldRedirectPublicUserToMaintenance } from "@/lib/maintenance-access"

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // 取引チャットはログイン必須（未認証の場合は Server Action でもセッションが使えない）
  if (pathname.startsWith("/chat/") && !authUser) {
    const loginUrl = new URL("/login", request.nextUrl)
    const redirectTo = `${pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("redirect", redirectTo)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith("/admin") || pathname === "/maintenance") {
    return supabaseResponse
  }

  const block = await shouldRedirectPublicUserToMaintenance(supabase)
  if (block) {
    return NextResponse.redirect(new URL("/maintenance", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: "/:path*",
}
