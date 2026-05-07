const CUSTOM_ID_RE = /^[a-z][a-z0-9_-]{2,29}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RESERVED_CUSTOM_IDS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "chat",
  "create-skill",
  "guide",
  "inquiry",
  "legal",
  "login",
  "maintenance",
  "mypage",
  "profile",
  "profile-setup",
  "signin",
  "skills",
])

export function normalizeCustomId(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function isValidCustomIdFormat(value: string): boolean {
  return CUSTOM_ID_RE.test(value)
}

export function isReservedCustomId(value: string): boolean {
  return RESERVED_CUSTOM_IDS.has(value)
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function buildProfilePath(profileId: string, customId?: string | null): string {
  const normalized = normalizeCustomId(customId)
  const segment = normalized.length > 0 ? normalized : profileId
  return `/profile/${encodeURIComponent(segment)}`
}
