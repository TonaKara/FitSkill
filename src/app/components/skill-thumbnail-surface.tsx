"use client"

import { cn } from "@/lib/utils"

type SkillThumbnailSurfaceProps = {
  imageUrl: string
  className?: string
  /** 一覧カード・出品プレビューは cover（16:10 枠と一致）。contain は特例用 */
  fit?: "cover" | "contain"
  /** 一覧カードのホバー拡大 */
  enableHoverZoom?: boolean
}

/**
 * スキルサムネイル用の背景画像レイヤー（既定は bg-cover・bg-center。一覧・詳細ヒーローと揃える）。
 */
export function SkillThumbnailSurface({
  imageUrl,
  className,
  fit = "cover",
  enableHoverZoom,
}: SkillThumbnailSurfaceProps) {
  const fitClasses = fit === "contain" ? "bg-contain bg-center bg-no-repeat" : "bg-cover bg-center"

  return (
    <div
      className={cn(
        "absolute inset-0",
        fitClasses,
        enableHoverZoom && "transition-transform duration-500 group-hover:scale-110",
        className,
      )}
      style={{ backgroundImage: `url(${imageUrl})` }}
    />
  )
}
