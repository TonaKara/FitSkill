"use client"

import { cn } from "@/lib/utils"

type SkillThumbnailSurfaceProps = {
  imageUrl: string
  className?: string
  /** 一覧カードのホバー拡大 */
  enableHoverZoom?: boolean
}

/**
 * スキル一覧カード（SkillCard）のサムネイル画像レイヤーと同一の描画（bg-cover + bg-center）。
 * 出品フォームのプレビューでも同じ見え方にするために共通化する。
 */
export function SkillThumbnailSurface({ imageUrl, className, enableHoverZoom }: SkillThumbnailSurfaceProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 bg-cover bg-center",
        enableHoverZoom && "transition-transform duration-500 group-hover:scale-110",
        className,
      )}
      style={{ backgroundImage: `url(${imageUrl})` }}
    />
  )
}
