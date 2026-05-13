/** プロフィールアイコンクロップ後の正方形 JPEG 一辺（px）。表示は object-cover で任意枠に合わせる */
export const PROFILE_AVATAR_CROP_EXPORT_PX = 512

/** profiles.avatar_url が空のときのプレースホルダー（ダーク×赤寄り） */
export function resolveProfileAvatarUrl(avatarUrl: string | null | undefined, displayName: string): string {
  const trimmed = avatarUrl?.trim() ?? ""
  if (trimmed.length > 0) {
    return trimmed
  }
  const name = displayName.trim() || "?"
  return `https://ui-avatars.com/api/?size=128&background=18181b&color=f87171&name=${encodeURIComponent(name)}`
}
