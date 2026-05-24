import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getBanStatusFromProfile } from "@/lib/ban"
import { pickLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale"
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  isSupportedLocale,
} from "@/lib/i18n/locales"
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

function isJapanEntryPath(pathname: string): boolean {
  return pathname === "/japan-entry" || pathname.startsWith("/japan-entry/")
}

/**
 * /japan-entry 配下は英語専用ランディングのため、ロケール Cookie を強制的に "en" へ切り替える。
 * - request.cookies を上書きすることで、同一リクエストの RSC（layout.tsx 等）も "en" で描画される。
 * - 一度この Cookie が "en" になれば、その後ヘッダー・フッター経由で他ページへ遷移しても英語表示が維持される。
 */
function applyJapanEntryLocaleOverride(request: NextRequest): void {
  if (!isJapanEntryPath(request.nextUrl.pathname)) {
    return
  }
  request.cookies.set(LOCALE_COOKIE_NAME, "en")
}

function setEnglishLocaleCookieIfJapanEntry(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!isJapanEntryPath(request.nextUrl.pathname)) {
    return response
  }
  response.cookies.set(LOCALE_COOKIE_NAME, "en", {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  })
  return response
}

/**
 * Cookie に locale が無いリクエストでは Accept-Language から推定し、
 * レスポンスに Set-Cookie する。
 * Cookie の有無を変えるだけで再描画は行わない（既存セッション処理に影響なし）。
 *
 * /japan-entry は専用ランディングのため、Cookie の現在値に関わらず常に "en" を Set-Cookie する。
 */
function ensureLocaleCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (isJapanEntryPath(request.nextUrl.pathname)) {
    return setEnglishLocaleCookieIfJapanEntry(request, response)
  }
  const existing = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  if (existing && isSupportedLocale(existing)) {
    return response
  }
  const detected = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"))
  response.cookies.set(LOCALE_COOKIE_NAME, detected, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  })
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
    return ensureLocaleCookie(request, withVercelNoIndex(request, NextResponse.next()))
  }

  /**
   * /japan-entry 配下では同一リクエスト中の RSC（layout.tsx）が "en" を読めるよう、
   * NextResponse.next({ request }) の前に request.cookies を上書きする。
   */
  applyJapanEntryLocaleOverride(request)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return ensureLocaleCookie(request, withVercelNoIndex(request, NextResponse.next()))
  }

  const supabaseResponse = NextResponse.next({
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
      return ensureLocaleCookie(request, withVercelNoIndex(request, NextResponse.redirect(bannedUrl)))
    }
  }

  // 取引チャットはログイン必須（未認証の場合は Server Action でもセッションが使えない）
  if (pathname.startsWith("/chat/") && !authUser) {
    const loginUrl = new URL("/login", request.nextUrl)
    const redirectTo = `${pathname}${request.nextUrl.search}`
    loginUrl.searchParams.set("redirect", redirectTo)
    return ensureLocaleCookie(request, withVercelNoIndex(request, NextResponse.redirect(loginUrl)))
  }

  // メンテ中でもログイン・メール認証コールバックは可能にする
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth/callback" ||
    pathname === "/auth/update-password"
  ) {
    return ensureLocaleCookie(request, withVercelNoIndex(request, supabaseResponse))
  }

  if (pathname.startsWith("/admin") || pathname === "/maintenance") {
    return ensureLocaleCookie(request, withVercelNoIndex(request, supabaseResponse))
  }

  const block = await shouldRedirectPublicUserToMaintenance(supabase)
  if (block) {
    return ensureLocaleCookie(
      request,
      withVercelNoIndex(request, NextResponse.redirect(new URL("/maintenance", request.url))),
    )
  }

  return ensureLocaleCookie(request, withVercelNoIndex(request, supabaseResponse))
}

export const config = {
  matcher: "/:path*",
}
