/** create-skill と一覧表示で共通のデフォルトサムネイル（public 配下） */
export const DEFAULT_SKILL_THUMBNAIL_PATH = "/images/default-skill.png"

/** 一覧カード（SkillCard）の画像領域と同一比率（16:10） */
export const SKILL_THUMBNAIL_ASPECT_RATIO = 16 / 10

export function resolveSkillThumbnailUrl(thumbnailUrl: string | null | undefined): string {
  const trimmed = thumbnailUrl?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : DEFAULT_SKILL_THUMBNAIL_PATH
}
