/** プロフィールアイコンクロップ後の正方形 JPEG 一辺（px）。表示は object-cover で任意枠に合わせる */
export const PROFILE_AVATAR_CROP_EXPORT_PX = 512

/** 保存済み avatar_url が有効なときだけ URL を返す（未設定時は null） */
export function getProfileAvatarUrl(avatarUrl: string | null | undefined): string | null {
  const trimmed = avatarUrl?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

/**
 * 画像 src 用。未設定時は空文字（ui-avatars 等のプレースホルダー URL は使わない）。
 * 表示は {@link ProfileAvatar} コンポーネントを利用してください。
 */
export function resolveProfileAvatarUrl(
  avatarUrl: string | null | undefined,
  _displayName?: string,
): string {
  return getProfileAvatarUrl(avatarUrl) ?? ""
}
