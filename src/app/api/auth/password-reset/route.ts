import { NextRequest, NextResponse } from "next/server"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { sendPasswordResetEmail } from "@/lib/password-reset-email"

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS_PER_IP = 5
const MAX_ATTEMPTS_PER_EMAIL = 3

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

const GENERIC_MESSAGE = "メールを送信しました。受信ボックスをご確認ください。"

/**
 * パスワード再設定メール送信エンドポイント。
 *
 * 設計のポイント:
 * - Supabase の `auth.resetPasswordForEmail` ではなく `admin.generateLink` + Resend を経由する
 *   独自送信に切り替えた。これは、Supabase 既定メールが PKCE の `?code=...` を含むため
 *   **別端末・別ブラウザでメールを開くと code_verifier 不在で再設定が失敗**する問題を解消するため。
 * - 新しい URL は `?token_hash=...&type=recovery&next=/auth/update-password` 形式で、
 *   `/auth/callback` の `verifyOtp` 経路でセッション化される（PKCE 非依存）。
 * - レスポンスは成功・失敗・レート制限のいずれでも同一文言を返し、アカウント有無を漏らさない
 *   既存挙動を維持する。
 */
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
  const blockedByEmail = consumeAttempt(emailAttempts, email, MAX_ATTEMPTS_PER_EMAIL, now)
  if (blockedByIp || blockedByEmail) {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 429 })
  }

  // メール本文の言語は、リクエスト元の Cookie / Accept-Language から推定。
  // 同端末・別端末いずれでも、メールを読む環境の言語と要求時の環境はおおむね一致する想定。
  const locale = await getServerLocale()

  try {
    await sendPasswordResetEmail(email, locale)
  } catch (error) {
    console.error("[password-reset] unexpected error during sendPasswordResetEmail", {
      message: error instanceof Error ? error.message : String(error),
    })
    // アカウント有無や内部状態を推測されないよう、成功時と同一レスポンスにする。
  }

  return NextResponse.json({ message: GENERIC_MESSAGE })
}
