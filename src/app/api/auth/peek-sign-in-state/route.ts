import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSiteUrl } from "@/lib/site-seo"

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS_PER_IP = 40

type RateLimitEntry = {
  count: number
  resetAt: number
}

const ipAttempts = new Map<string, RateLimitEntry>()

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

function isRateLimited(store: Map<string, RateLimitEntry>, key: string, limit: number, now: number): boolean {
  const current = store.get(key)
  if (!current || current.resetAt <= now) {
    return false
  }
  return current.count >= limit
}

function consumeAttempt(store: Map<string, RateLimitEntry>, key: string, limit: number, now: number): void {
  const current = store.get(key)
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }

  if (current.count >= limit) {
    return
  }

  store.set(key, { count: current.count + 1, resetAt: current.resetAt })
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return null
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type PeekRow = {
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")?.trim()
  const siteOrigin = new URL(getSiteUrl()).origin
  if (!origin || origin !== siteOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = Date.now()
  const ip = getClientIp(request)
  if (isRateLimited(ipAttempts, ip, MAX_ATTEMPTS_PER_IP, now)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  consumeAttempt(ipAttempts, ip, MAX_ATTEMPTS_PER_IP, now)

  let email = ""
  try {
    const body = (await request.json()) as { email?: unknown }
    email = normalizeEmail(body.email)
  } catch {
    return NextResponse.json({ found: false, pendingFirstPasswordLogin: false }, { status: 400 })
  }

  if (!isLikelyEmail(email)) {
    return NextResponse.json({ found: false, pendingFirstPasswordLogin: false })
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return NextResponse.json({ found: false, pendingFirstPasswordLogin: false, skipped: true })
  }

  const { data, error } = await admin.rpc("peek_auth_user_sign_in_state", { p_email: email })
  if (error) {
    console.error("[peek-sign-in-state] rpc", error)
    return NextResponse.json({ found: false, pendingFirstPasswordLogin: false })
  }

  if (data == null || typeof data !== "object") {
    return NextResponse.json({ found: false, pendingFirstPasswordLogin: false })
  }

  const row = data as PeekRow
  const confirmed =
    row.email_confirmed_at != null &&
    typeof row.email_confirmed_at === "string" &&
    row.email_confirmed_at.trim().length > 0
  const hasSignedIn =
    row.last_sign_in_at != null &&
    typeof row.last_sign_in_at === "string" &&
    row.last_sign_in_at.trim().length > 0

  return NextResponse.json({
    found: true,
    pendingFirstPasswordLogin: confirmed && !hasSignedIn,
  })
}
