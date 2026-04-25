/** profiles.avatar_url が空のときのプレースホルダー（ダーク×赤寄り） */
export function resolveProfileAvatarUrl(avatarUrl: string | null | undefined, displayName: string): string {
  const trimmed = avatarUrl?.trim() ?? ""
  if (trimmed.length > 0) {
    return trimmed
  }
  const name = displayName.trim() || "?"
  return `https://ui-avatars.com/api/?size=128&background=18181b&color=f87171&name=${encodeURIComponent(name)}`
}
