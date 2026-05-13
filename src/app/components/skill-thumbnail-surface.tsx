"use client"

import { cn } from "@/lib/utils"

type SkillThumbnailSurfaceProps = {
  imageUrl: string
  className?: string
  /** 一覧カードは cover。出品プレビュー等は contain で切り欠きを防ぐ */
  fit?: "cover" | "contain"
  /** 一覧カードのホバー拡大 */
  enableHoverZoom?: boolean
}

/**
 * スキルサムネイル用の背景画像レイヤー（一覧は bg-cover、プレビューは bg-contain 等）。
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
