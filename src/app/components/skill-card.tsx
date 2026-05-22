"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, Clock, Users, Heart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SkillCardFavorite } from "@/components/skill-card-favorite"
import { ProfileAvatar } from "@/components/profile-avatar"
import { formatSkillCategoryBadgeLabel, localizeStoredCategory } from "@/lib/skill-categories"
import { SkillThumbnailSurface } from "@/components/skill-thumbnail-surface"
import { saveHomeListScrollPosition } from "@/lib/home-list-scroll"
import { skillThumbnailContainerAspectStyle } from "@/lib/skill-thumbnail"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"
import { formatCurrencyPlain, normalizeCurrency } from "@/lib/currency"

interface SkillCardProps {
  /** DB のスキル UUID のときのみ指定。お気に入り・件数のリアルタイム更新を有効にする */
  favoriteSkillId?: string
  /** 一覧などで件数が既に分かっているとき（未取得の 0 表示チラつき防止） */
  initialFavoriteCount?: number
  skill: {
    id: number | string
    title: string
    instructor: string
    instructorAvatarUrl: string | null
    category: string
    rating: number
    reviewCount: number
    price: number
    /**
     * 価格の通貨コード。未指定なら 'JPY' フォールバックとなり、これまでと同じ "¥{price}" 表示。
     */
    currency?: string | null
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
  const locale = useLocale()
  const tCard = useTranslations("skillCard")
  const badgeLabel = formatSkillCategoryBadgeLabel(skill.category)
  const localizedBadgeLabel = localizeStoredCategory(badgeLabel, locale)
  // 表示上の duration を locale に応じて整える。
  // map-skill-to-card.ts は "30分" 形式で生成しているため、英語版では末尾の単位（分・min など）
  // を取り除いて数値のみを表示する。アイコン (Clock) がコンテキストを補う。
  const durationMinutesMatch = skill.duration.match(/(\d+)/)
  const durationNumeric = durationMinutesMatch?.[1] ?? skill.duration
  const displayDuration =
    locale === "en"
      ? tCard("durationFormat", { minutes: durationNumeric })
      : skill.duration
  // map-skill-to-card.ts は instructor を「DB の display_name または空文字」で返すため、
  // 空のときに locale 別フォールバック「講師 / Instructor」をここで当てる。
  const displayInstructor =
    skill.instructor.length > 0 ? skill.instructor : tCard("instructorFallback")

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
      aria-label={canOpenDetail ? tCard("openDetailAria", { title: skill.title }) : undefined}
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
              {tCard("popular")}
            </Badge>
          )}
          {skill.isNew && (
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-semibold">
              {tCard("new")}
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
          <Badge
            variant="outline"
            className="border-primary/45 bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary-readable shadow-sm shadow-primary/10 backdrop-blur-md dark:border-red-400/50 dark:bg-red-950/70 dark:text-red-50 dark:shadow-black/30"
          >
            {localizedBadgeLabel}
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
          <ProfileAvatar
            avatarUrl={skill.instructorAvatarUrl}
            alt=""
            className="h-6 w-6"
            ringClassName="ring-2 ring-primary/20"
            sizes="24px"
            iconClassName="min-h-2.5 min-w-2.5 max-h-4 max-w-4"
          />
          <span className="text-sm text-muted-foreground">{displayInstructor}</span>
        </div>

        {/* Stats */}
        <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary-readable text-primary-readable" />
            <span className="font-medium text-foreground">{Number(skill.rating).toFixed(1)}</span>
            <span>{tCard("reviewsCount", { count: String(skill.reviewCount) })}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{displayDuration}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{tCard("studentsCount", { count: String(skill.students) })}</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-primary-readable">
              {formatCurrencyPlain(skill.price, normalizeCurrency(skill.currency))}
            </span>
            <span className="text-xs text-muted-foreground">{tCard("perSession")}</span>
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
                {tCard("viewDetail")}
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled
              className="h-auto max-w-[11.5rem] whitespace-normal px-2 py-1 text-[11px] leading-tight text-center cursor-not-allowed bg-zinc-700 font-semibold text-zinc-300 opacity-100 hover:bg-zinc-700"
            >
              <span>
                {tCard("referenceOnlyLine1")}
                <br />
                {tCard("referenceOnlyLine2")}
              </span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
