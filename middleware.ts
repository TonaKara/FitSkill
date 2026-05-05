import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getBanStatusFromProfile } from "@/lib/ban"
import { shouldRedirectPublicUserToMaintenance } from "@/lib/maintenance-access"

/**
 * このミドルウェアは 403 Forbidden を返さない。
 * - 未ログインでも `/`（トップ）は通過する（Supabase セッション更新用に処理は走るが拒否しない）。
 * - `/chat/*` 未ログインは 403 ではなく `/login` へリダイレクト。
 * - メンテ時は `/maintenance` へリダイレクト。
 * プレビュー URL 全体が 403 になる場合は Vercel の Deployment Protection 等を疑う（アプリ外の要因）。
 *
 * メンテ誘導・認証チェックの対象外にするパス。
 * - /sitemap.xml は拡張子ありだが明示しておく（環境によっては判定漏れ防止）
 * - /opengraph-image 等は拡張子なしのため明示
 */
function isBypassMiddlewarePath(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return true
  }
  if (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
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
  const { pathname } = request.nextUrl

  if (isBypassMiddlewarePath(pathname)) {
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
      return NextResponse.redirect(bannedUrl)
    }
  }

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
