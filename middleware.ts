import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getBanStatusFromProfile } from "@/lib/ban"
import { shouldRedirectPublicUserToMaintenance } from "@/lib/maintenance-access"
import { getCanonicalHostname } from "@/lib/site-seo"

/**
 * このミドルウェアは 403 Forbidden を返さない。
 * - 未ログインでも `/`（トップ）は通過する（Supabase セッション更新用に処理は走るが拒否しない）。
 * - `/chat/*` 未ログインは 403 ではなく `/login` へリダイレクト。
 * - メンテ時は `/maintenance` へリダイレクト。
 * プレビュー URL 全体が 403 になる場合は Vercel の Deployment Protection 等を疑う（アプリ外の要因）。
 *
 * メンテ誘導・認証チェックの対象外にするパス。
 * - /sitemap.xml は拡張子ありだが明示しておく（環境によっては判定漏れ防止）
 * - ルート配下の opengraph-image・twitter-image はパスに含まれるため contains で明示
 */
function isVercelDeploymentHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".vercel.app")
}

function withVercelNoIndex(request: NextRequest, response: NextResponse): NextResponse {
  if (isVercelDeploymentHost(request.nextUrl.hostname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }
  return response
}

function redirectWwwToCanonicalHost(request: NextRequest): NextResponse | null {
  const requestHost = request.nextUrl.hostname.toLowerCase()
  const canonicalHost = getCanonicalHostname()
  if (requestHost !== `www.${canonicalHost}`) {
    return null
  }
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.hostname = canonicalHost
  redirectUrl.protocol = "https:"
  redirectUrl.port = ""
  return NextResponse.redirect(redirectUrl, 301)
}

function isBypassMiddlewarePath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return true
  }
  if (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico" ||
    pathname.includes("/opengraph-image") ||
    pathname.includes("/twitter-image") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon")
  ) {
    return true
  }
  // public 配下の静的ファイル（拡張子付き）
  if (pathname.includes(".")) {
    return true
  }
  return false
}

const BAN_ALLOWED_TRANSACTION_STATUSES = ["progress", "in_progress", "active", "approval_pending", "disputed"] as const

async function canBannedUserAccessChatPath(args: {
  pathname: string
  userId: string
  supabase: ReturnType<typeof createServerClient>
}): Promise<boolean> {
  const { pathname, userId, supabase } = args
  if (!pathname.startsWith("/chat/")) {
    return false
  }

  const [, , rawTransactionId] = pathname.split("/")
  const transactionId = (rawTransactionId ?? "").trim()
  if (!transactionId) {
    return false
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id, buyer_id, seller_id, status")
    .eq("id", transactionId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  const row = data as {
    buyer_id?: string | null
    seller_id?: string | null
    status?: string | null
  }
  const isParticipant = row.buyer_id === userId || row.seller_id === userId
  if (!isParticipant) {
    return false
  }
  const status = String(row.status ?? "")
  return BAN_ALLOWED_TRANSACTION_STATUSES.includes(status as (typeof BAN_ALLOWED_TRANSACTION_STATUSES)[number])
}

export async function middleware(request: NextRequest) {
  const wwwRedirect = redirectWwwToCanonicalHost(request)
  if (wwwRedirect) {
    return withVercelNoIndex(request, wwwRedirect)
  }

  const { pathname } = request.nextUrl

  if (isBypassMiddlewarePath(pathname)) {
    return withVercelNoIndex(request, NextResponse.next())
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return withVercelNoIndex(request, NextResponse.next())
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

  if (authUser) {
    const { isBanned, isAdmin } = await getBanStatusFromProfile(supabase, authUser.id)
    const allowForBannedBase =
      pathname === "/" || pathname === "/banned" || pathname === "/contact" || pathname === "/contact/success"
    const allowBannedChat = await canBannedUserAccessChatPath({
      pathname,
      userId: authUser.id,
      supabase,
    })
    if (isBanned && !isAdmin && !allowForBannedBase && !allowBannedChat) {
      const bannedUrl = new URL("/banned", request.nextUrl)
      return withVercelNoIndex(request, NextResponse.redirect(bannedUrl))
    }
  }

  // 取引チャットはログイン必須（未認証の場合は Server Action でもセッションが使えない）
  if (pathname.startsWith("/chat/") && !authUser) {
    const loginUrl = new URL("/login", request.nextUrl)
    const redirectTo = `${pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("redirect", redirectTo)
    return withVercelNoIndex(request, NextResponse.redirect(loginUrl))
  }

  // メンテ中でもログインは可能にする（ログイン後、管理者は全ページ・一般ユーザーは /maintenance へ誘導される）
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return withVercelNoIndex(request, supabaseResponse)
  }

  if (pathname.startsWith("/admin") || pathname === "/maintenance") {
    return withVercelNoIndex(request, supabaseResponse)
  }

  const block = await shouldRedirectPublicUserToMaintenance(supabase)
  if (block) {
    return withVercelNoIndex(request, NextResponse.redirect(new URL("/maintenance", request.url)))
  }

  return withVercelNoIndex(request, supabaseResponse)
}

export const config = {
  matcher: "/:path*",
}
