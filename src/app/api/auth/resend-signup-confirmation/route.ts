import { NextRequest, NextResponse } from "next/server"
import {
  sendSignupConfirmationEmail,
  type SignupConfirmationResendFailureReason,
} from "@/lib/signup-confirmation-resend"

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

const GENERIC_MESSAGE = "確認メールを再送しました。受信ボックスをご確認ください。"
const FAILURE_MESSAGE = "確認メールの再送に失敗しました。時間を置いて再度お試しください。"
const CONFIG_FAILURE_MESSAGE =
  "現在、確認メールを再送できません。しばらくしてから再度お試しください。解決しない場合はお問い合わせください。"
const DELIVERY_FAILURE_MESSAGE =
  "確認メールを送信できませんでした。受信トレイと迷惑メールフォルダをご確認のうえ、時間を置いて再度お試しください。"
const LINK_FAILURE_MESSAGE =
  "確認用リンクの作成に失敗しました。時間を置いて再度お試しください。解決しない場合はお問い合わせください。"

function resolveFailureMessage(reason: SignupConfirmationResendFailureReason): string {
  if (reason === "missing_config") {
    return CONFIG_FAILURE_MESSAGE
  }
  if (reason === "delivery") {
    return DELIVERY_FAILURE_MESSAGE
  }
  return LINK_FAILURE_MESSAGE
}

export async function POST(request: NextRequest) {
  let email = ""
  try {
    const body = (await request.json()) as { email?: unknown }
    email = normalizeEmail(body.email)
  } catch {
    return NextResponse.json({ message: FAILURE_MESSAGE, delivered: false }, { status: 400 })
  }

  if (!isLikelyEmail(email)) {
    return NextResponse.json({ message: FAILURE_MESSAGE, delivered: false }, { status: 400 })
  }

  const now = Date.now()
  const ip = getClientIp(request)
  if (isRateLimited(ipAttempts, ip, MAX_ATTEMPTS_PER_IP, now)) {
    return NextResponse.json({ message: FAILURE_MESSAGE, delivered: false, reason: "rate_limited" }, { status: 429 })
  }

  if (isRateLimited(emailAttempts, email, MAX_ATTEMPTS_PER_EMAIL, now)) {
    return NextResponse.json(
      {
        message: "確認メールの再送は1回までです。届かない場合はお問い合わせください。",
        delivered: false,
        reason: "rate_limited",
      },
      { status: 429 },
    )
  }

  const result = await sendSignupConfirmationEmail(email)
  if (!result.ok) {
    console.error("[resend-signup-confirmation] delivery failed", { email, reason: result.reason })
    return NextResponse.json(
      { message: resolveFailureMessage(result.reason), delivered: false, reason: result.reason },
      { status: result.reason === "missing_config" ? 503 : 502 },
    )
  }

  consumeAttempt(ipAttempts, ip, MAX_ATTEMPTS_PER_IP, now)
  consumeAttempt(emailAttempts, email, MAX_ATTEMPTS_PER_EMAIL, now)
  return NextResponse.json({ message: GENERIC_MESSAGE, delivered: true })
}
