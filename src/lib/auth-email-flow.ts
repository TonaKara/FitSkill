import { getSiteUrl, normalizeSiteOrigin } from "@/lib/site-seo"

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
  const base = explicit
    ? normalizeSiteOrigin(explicit)
    : typeof window !== "undefined"
      ? window.location.origin
      : getSiteUrl()
  const params = new URLSearchParams({ next: safeNext })
  return `${base.replace(/\/$/, "")}/auth/callback?${params.toString()}`
}
