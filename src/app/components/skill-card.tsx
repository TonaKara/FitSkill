"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, Clock, Users, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SkillCardFavorite } from "@/components/skill-card-favorite"
import { SkillThumbnailSurface } from "@/components/skill-thumbnail-surface"
import { saveHomeListScrollPosition } from "@/lib/home-list-scroll"
import { skillThumbnailContainerAspectStyle } from "@/lib/skill-thumbnail"

interface SkillCardProps {
  /** DB のスキル UUID のときのみ指定。お気に入り・件数のリアルタイム更新を有効にする */
  favoriteSkillId?: string
  /** 一覧などで件数が既に分かっているとき（未取得の 0 表示チラつき防止） */
  initialFavoriteCount?: number
  skill: {
    id: number | string
    title: string
    instructor: string
    instructorImage: string
    category: string
    rating: number
    reviewCount: number
    price: number
    duration: string
    students: number
    image: string
    isPopular?: boolean
    isNew?: boolean
    /** 指定時は「詳細を見る」が詳細ページへ遷移する */
    detailHref?: string
  }
}

export function SkillCard({ skill, favoriteSkillId, initialFavoriteCount }: SkillCardProps) {
  const router = useRouter()
  const canOpenDetail = Boolean(skill.detailHref)

  const handleCardClick = () => {
    if (!skill.detailHref) {
      return
    }
    saveHomeListScrollPosition()
    router.push(skill.detailHref)
  }

  return (
    <Card
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (!canOpenDetail) {
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          handleCardClick()
        }
      }}
      role={canOpenDetail ? "link" : undefined}
      tabIndex={canOpenDetail ? 0 : undefined}
      aria-label={canOpenDetail ? `${skill.title}の詳細を開く` : undefined}
      className="group overflow-hidden border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 data-[clickable=true]:cursor-pointer"
      data-clickable={canOpenDetail}
    >
      {/* Image */}
      <div className="relative overflow-hidden" style={skillThumbnailContainerAspectStyle()}>
        <SkillThumbnailSurface imageUrl={skill.image} enableHoverZoom />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        
        {/* Badges */}
        <div className="absolute left-3 top-3 flex gap-2">
          {skill.isPopular && (
            <Badge className="bg-primary text-primary-foreground font-semibold">
              人気
            </Badge>
          )}
          {skill.isNew && (
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-semibold">
              NEW
            </Badge>
          )}
        </div>

        {/* Like Button */}
        {favoriteSkillId ? (
          <SkillCardFavorite
            key={favoriteSkillId}
            skillId={favoriteSkillId}
            initialFavoriteCount={initialFavoriteCount}
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-auto min-w-8 gap-1 rounded-full bg-background/50 px-2 py-1.5 backdrop-blur-sm hover:bg-background/80"
            disabled
            aria-hidden
          >
            <Heart className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium tabular-nums leading-none text-muted-foreground">0</span>
          </Button>
        )}

        {/* Category */}
        <div className="absolute bottom-3 left-3">
          <Badge variant="outline" className="border-border/50 bg-background/50 backdrop-blur-sm text-foreground">
            {skill.category}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-base font-bold text-foreground group-hover:text-primary-readable transition-colors">
          {skill.title}
        </h3>

        {/* Instructor */}
        <div className="mb-3 flex items-center gap-2">
          <div
            className="h-6 w-6 rounded-full bg-cover bg-center ring-2 ring-primary/20"
            style={{ backgroundImage: `url(${skill.instructorImage})` }}
          />
          <span className="text-sm text-muted-foreground">{skill.instructor}</span>
        </div>

        {/* Stats */}
        <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary-readable text-primary-readable" />
            <span className="font-medium text-foreground">{Number(skill.rating).toFixed(1)}</span>
            <span>({skill.reviewCount}件)</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{skill.duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{skill.students}人</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-primary-readable">
              ¥{skill.price.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">/回</span>
          </div>
          {skill.detailHref ? (
            <Button size="sm" asChild className="bg-primary hover:bg-primary/90 font-semibold text-primary-foreground">
              <Link
                href={skill.detailHref}
                onClick={(e) => {
                  saveHomeListScrollPosition()
                  e.stopPropagation()
                }}
              >
                詳細を見る
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled
              className="h-auto max-w-[11.5rem] whitespace-normal px-2 py-1 text-[11px] leading-tight text-center cursor-not-allowed bg-zinc-700 font-semibold text-zinc-300 opacity-100 hover:bg-zinc-700"
            >
              <span>
                参考データのため、
                <br />
                ご購入いただけません
              </span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
