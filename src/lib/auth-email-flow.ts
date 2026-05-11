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
