/** create-skill と一覧表示で共通のデフォルトサムネイル（public 配下） */
export const DEFAULT_SKILL_THUMBNAIL_PATH = "/images/default-skill.png"

/** 一覧カード（SkillCard）の画像領域と同一比率（16:10） */
export const SKILL_THUMBNAIL_ASPECT_RATIO = 16 / 10

/**
 * クロップ後 JPEG のピクセル寸法（16:10 固定）。
 * canvas 出力と表示側 aspect / object-cover の前提を一致させる。
 */
export const SKILL_THUMBNAIL_EXPORT_WIDTH = 1600
export const SKILL_THUMBNAIL_EXPORT_HEIGHT = 1000

/** コンテナに `aspect-ratio` を付けるとき共通化（Tailwind の aspect-[16/10] と同値） */
export const skillThumbnailContainerAspectStyle = (): { aspectRatio: number } => ({
  aspectRatio: SKILL_THUMBNAIL_ASPECT_RATIO,
})

export function resolveSkillThumbnailUrl(thumbnailUrl: string | null | undefined): string {
  const trimmed = thumbnailUrl?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : DEFAULT_SKILL_THUMBNAIL_PATH
}
