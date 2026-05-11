import { NextRequest, NextResponse } from "next/server"
import { sendSignupConfirmationEmail } from "@/lib/signup-confirmation-resend"

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS_PER_IP = 8
const MAX_ATTEMPTS_PER_EMAIL = 1

type RateLimitEntry = {
  count: number
  resetAt: number
}

const ipAttempts = new Map<string, RateLimitEntry>()
const emailAttempts = new Map<string, RateLimitEntry>()

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

function consumeAttempt(store: Map<string, RateLimitEntry>, key: string, limit: number, now: number): boolean {
  const current = store.get(key)
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (current.count >= limit) {
    return true
  }

  store.set(key, { count: current.count + 1, resetAt: current.resetAt })
  return false
}

const GENERIC_MESSAGE = "確認メールを再送しました。受信ボックスをご確認ください。"

export async function POST(request: NextRequest) {
  let email = ""
  try {
    const body = (await request.json()) as { email?: unknown }
    email = normalizeEmail(body.email)
  } catch {
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }

  if (!isLikelyEmail(email)) {
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }

  const now = Date.now()
  const ip = getClientIp(request)
  const blockedByIp = consumeAttempt(ipAttempts, ip, MAX_ATTEMPTS_PER_IP, now)
  if (blockedByIp) {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 429 })
  }

  const emailRateLimit = emailAttempts.get(email)
  if (emailRateLimit && emailRateLimit.resetAt > now && emailRateLimit.count >= MAX_ATTEMPTS_PER_EMAIL) {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 429 })
  }

  const sent = await sendSignupConfirmationEmail(email)
  if (!sent) {
    console.error("[resend-signup-confirmation] delivery failed", { email })
  } else {
    consumeAttempt(emailAttempts, email, MAX_ATTEMPTS_PER_EMAIL, now)
  }

  return NextResponse.json({ message: GENERIC_MESSAGE })
}
