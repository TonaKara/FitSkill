import { getAppBaseUrl, normalizeSiteOrigin } from "@/lib/site-seo"

export function sanitizeAuthNextPath(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim()
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/profile-setup"
  }
  return value
}

export function buildAuthCallbackRedirectUrl(nextPath: string): string {
  const safeNext = sanitizeAuthNextPath(nextPath)
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const base =
    typeof window !== "undefined" && !explicit
      ? window.location.origin
      : explicit
        ? normalizeSiteOrigin(explicit)
        : getAppBaseUrl()
  const params = new URLSearchParams({ next: safeNext })
  return `${base.replace(/\/$/, "")}/auth/callback?${params.toString()}`
}

export const SIGNUP_CONFIRMATION_NEXT_PATH = "/profile-setup"

/** メール確認リンクの `next` が新規登録フローか */
export function isSignupEmailConfirmationNextPath(nextPath: string): boolean {
  return sanitizeAuthNextPath(nextPath) === sanitizeAuthNextPath(SIGNUP_CONFIRMATION_NEXT_PATH)
}

export function buildSignupVerifiedLoginUrl(): string {
  return "/login?signup_verified=1"
}

export function buildSignupConfirmationRedirectUrl(): string {
  return buildAuthCallbackRedirectUrl(SIGNUP_CONFIRMATION_NEXT_PATH)
}

export const SIGNUP_PENDING_VERIFICATION_EMAIL_KEY = "gritvib.signup.pending_verification_email"

export function persistSignupPendingVerificationEmail(email: string): void {
  if (typeof window === "undefined") {
    return
  }
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return
  }
  window.sessionStorage.setItem(SIGNUP_PENDING_VERIFICATION_EMAIL_KEY, normalized)
}

export function readSignupPendingVerificationEmail(): string | null {
  if (typeof window === "undefined") {
    return null
  }
  const value = window.sessionStorage.getItem(SIGNUP_PENDING_VERIFICATION_EMAIL_KEY)?.trim().toLowerCase()
  return value || null
}

export function clearSignupPendingVerificationEmail(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.removeItem(SIGNUP_PENDING_VERIFICATION_EMAIL_KEY)
}

export const SIGNUP_VERIFICATION_RESENT_KEY = "gritvib.signup.verification_resent.v2"

export function markSignupVerificationResent(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.setItem(SIGNUP_VERIFICATION_RESENT_KEY, "1")
}

export function hasSignupVerificationBeenResent(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  return window.sessionStorage.getItem(SIGNUP_VERIFICATION_RESENT_KEY) === "1"
}

export function clearSignupVerificationResent(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.removeItem(SIGNUP_VERIFICATION_RESENT_KEY)
}

/** メール確認後にログイン画面から入った初回ログインで `/profile-setup` へ誘導するためのセッション印 */
const POST_EMAIL_CONFIRM_LOGIN_SESSION_KEY = "gritvib.post_email_confirm_login.v1"

/** ログイン画面の「ログインができない場合」案内を二度と出さない（初回のみ用） */
const POST_EMAIL_CONFIRM_LOGIN_HELP_DONE_KEY = "gritvib.post_email_confirm_login_help_done.v1"

export function markSessionPostEmailConfirmLogin(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.setItem(POST_EMAIL_CONFIRM_LOGIN_SESSION_KEY, "1")
}

export function isSessionPostEmailConfirmLogin(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  return window.sessionStorage.getItem(POST_EMAIL_CONFIRM_LOGIN_SESSION_KEY) === "1"
}

export function clearSessionPostEmailConfirmLogin(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.removeItem(POST_EMAIL_CONFIRM_LOGIN_SESSION_KEY)
}

export function isPostEmailConfirmLoginHelpDone(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  return window.localStorage.getItem(POST_EMAIL_CONFIRM_LOGIN_HELP_DONE_KEY) === "1"
}

export function markPostEmailConfirmLoginHelpDone(): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(POST_EMAIL_CONFIRM_LOGIN_HELP_DONE_KEY, "1")
}
