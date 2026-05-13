"use client"

import { cn } from "@/lib/utils"

type SkillThumbnailSurfaceProps = {
  imageUrl: string
  className?: string
  /**
   * cover … 一覧カード等。contain … 特例。
   * fill … 背景を 100%×100% で伸ばす（クロップ済み 16:10 を枠にピッタリ合わせるプレビュー用）
   */
  fit?: "cover" | "contain" | "fill"
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
  const fitClasses =
    fit === "contain"
      ? "bg-contain bg-center bg-no-repeat"
      : fit === "fill"
        ? "bg-center bg-no-repeat"
        : "bg-cover bg-center"

  const fillStyle = fit === "fill" ? ({ backgroundSize: "100% 100%" } as const) : undefined

  return (
    <div
      className={cn(
        "absolute inset-0",
        fitClasses,
        enableHoverZoom && "transition-transform duration-500 group-hover:scale-110",
        className,
      )}
      style={{ backgroundImage: `url(${imageUrl})`, ...fillStyle }}
    />
  )
}
