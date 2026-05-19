"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2, Star } from "lucide-react"
import { ReportModal } from "@/components/report/ReportModal"
import { SkillCard } from "@/components/skill-card"
import { NotificationToast } from "@/components/ui/notification-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { mapSkillRowToCardSkillWithInstructor, type SkillRowForCard } from "@/lib/map-skill-to-card"
import type { AppNotice } from "@/lib/notifications"
import {
  fetchProfileRatingData,
  type ProfileRatingComment,
  type ProfileRatingDistribution,
} from "@/lib/profile-ratings"
import { ProfileAvatar } from "@/components/profile-avatar"
import { getProfileAvatarUrl } from "@/lib/profile-avatar"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  formatProfileInterestTagsForDisplay,
  loadProfileInterestCategories,
} from "@/lib/profile-interest-categories"

type ProfileRow = {
  id: string
  display_name: string | null
  bio: string | null
  fitness_history: string | null
  category: unknown
  avatar_url: string | null
  rating_avg: number | null
  review_count: number | null
}

function normalizeCategoryTags(raw: unknown): string[] {
  return formatProfileInterestTagsForDisplay(loadProfileInterestCategories(raw))
}

const STAR_LEVELS: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1]

function createEmptyDistribution(): ProfileRatingDistribution {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
}

function formatRatingDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function StoreEmptyPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/80 p-8 text-center dark:border-border dark:bg-muted/30">
      <p className="text-sm font-normal text-neutral-400 dark:text-muted-foreground">{children}</p>
    </div>
  )
}

type PublicProfilePageProps = {
  resolvedProfileId?: string
}

export default function PublicProfilePage({ resolvedProfileId }: PublicProfilePageProps) {
  const params = useParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const profileUserIdFromRoute =
    typeof params.user_id === "string" ? params.user_id : Array.isArray(params.user_id) ? params.user_id[0] : ""
  const profileUserId = resolvedProfileId?.trim() || profileUserIdFromRoute

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [skills, setSkills] = useState<SkillRowForCard[]>([])
  const [ratingDistribution, setRatingDistribution] = useState<ProfileRatingDistribution>(createEmptyDistribution())
  const [ratingComments, setRatingComments] = useState<ProfileRatingComment[]>([])
  const [selectedReviewStars, setSelectedReviewStars] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [skillsError, setSkillsError] = useState<string | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  const load = useCallback(async () => {
    if (!profileUserId) {
      setProfile(null)
      setSkills([])
      setRatingDistribution(createEmptyDistribution())
      setRatingComments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setSkillsError(null)

    const profileResult = await supabase
      .from("profiles_public")
      .select("id, display_name, bio, fitness_history, category, avatar_url, rating_avg, review_count")
      .eq("id", profileUserId)
      .maybeSingle()

    if (profileResult.error || !profileResult.data) {
      setProfile(null)
      setSkills([])
      setRatingDistribution(createEmptyDistribution())
      setRatingComments([])
      setLoading(false)
      return
    }

    const resolvedProfile = profileResult.data as ProfileRow
    const [skillsResult, ratingData] = await Promise.all([
      supabase
        .from("skills")
        .select("id, title, category, price, duration_minutes, max_capacity, thumbnail_url")
        .eq("user_id", resolvedProfile.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      fetchProfileRatingData(supabase, resolvedProfile.id),
    ])

    setProfile(resolvedProfile)

    if (skillsResult.error) {
      setSkills([])
      setSkillsError("出品スキルの取得に失敗しました。")
    } else {
      setSkills((skillsResult.data ?? []) as SkillRowForCard[])
    }
    setRatingDistribution(ratingData.distribution)
    setRatingComments(ratingData.comments)
    setLoading(false)
  }, [profileUserId, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-[50vh] items-center justify-center text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-lg font-bold text-neutral-900 dark:text-foreground">ストアが見つかりません</p>
          <Button asChild className="mt-8 bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
            <Link href="/">ホームへ戻る</Link>
          </Button>
        </div>
      </div>
    )
  }

  const name = profile.display_name?.trim() || "ユーザー"
  const avatarUrl = profile.avatar_url
  const hasRating =
    profile.rating_avg != null &&
    Number.isFinite(Number(profile.rating_avg)) &&
    profile.review_count != null &&
    Number.isFinite(Number(profile.review_count)) &&
    profile.review_count > 0
  const reviewCount = Math.max(0, Number(profile.review_count ?? 0))
  const averageRating = hasRating ? Number(profile.rating_avg).toFixed(1) : "0.0"
  const distributionTotal = STAR_LEVELS.reduce((sum, level) => sum + ratingDistribution[level], 0)
  const graphDenominator = reviewCount > 0 ? reviewCount : distributionTotal
  const filteredRatingComments =
    selectedReviewStars == null
      ? ratingComments
      : ratingComments.filter((comment) => comment.rating === selectedReviewStars)

  const categoryTags = normalizeCategoryTags(profile.category)
  const bioText = profile.bio?.trim() ?? ""

  const cardSkills = skills.map((row) =>
    mapSkillRowToCardSkillWithInstructor(row, {
      name,
      avatarUrl: getProfileAvatarUrl(avatarUrl),
    }),
  )

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <main className="mx-auto max-w-6xl px-4 pb-12 pt-6 md:pt-8">
        <div className="md:grid md:grid-cols-3 md:items-start md:gap-8">
          {/* 左: プロフィール */}
          <aside className="md:col-span-1">
            <header className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 md:sticky md:top-20 md:p-8">
              <ProfileAvatar
                avatarUrl={avatarUrl}
                alt={name}
                className="mx-auto h-28 w-28 md:mx-0 md:h-32 md:w-32"
                ringClassName="ring-2 ring-primary/35"
                sizes="128px"
              />
              <div className="mt-6 min-w-0 text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-foreground">{name}</h1>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  {hasRating ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 py-1 text-sm text-foreground">
                      <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
                      <span className="font-bold">{Number(profile.rating_avg).toFixed(1)}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-sm text-neutral-500 dark:text-muted-foreground">
                        レビュー {profile.review_count} 件
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-neutral-400 dark:text-muted-foreground">評価なし</span>
                  )}
                </div>
                {categoryTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                    {categoryTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="border-primary/35 bg-primary/10 text-xs font-medium text-primary-readable"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 border-t border-primary/20 pt-6 text-left">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-primary-readable">自己紹介</h2>
                  {bioText ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm font-normal leading-relaxed text-neutral-600 dark:text-muted-foreground">
                      {bioText}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm font-normal text-neutral-400 dark:text-muted-foreground">
                      プロフィール文はまだ登録されていません。
                    </p>
                  )}
                </div>
              </div>
            </header>
          </aside>

          {/* 右: スキル・評価 */}
          <div className="mt-10 space-y-12 md:col-span-2 md:mt-0">
            <section>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-foreground">出品中のスキル</h2>
              <div className="mt-6">
                {skillsError ? (
                  <p className="text-sm text-destructive">{skillsError}</p>
                ) : cardSkills.length === 0 ? (
                  <StoreEmptyPlaceholder>出品中の商品はまだありません。</StoreEmptyPlaceholder>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {cardSkills.map((skill) => (
                      <SkillCard key={String(skill.id)} favoriteSkillId={String(skill.id)} skill={skill} />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-foreground">評価</h2>
              {graphDenominator > 0 ? (
                <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr] md:items-center">
                  <div className="rounded-xl border border-border bg-muted/40 p-5 md:flex md:h-[176px] md:flex-col md:justify-center">
                    <p className="text-xs font-semibold tracking-wide text-neutral-400 dark:text-muted-foreground">
                      平均評価
                    </p>
                    <p className="mt-2 text-6xl font-black leading-none text-neutral-950 dark:text-foreground">
                      {averageRating}
                    </p>
                    <div className="mt-3 flex items-center gap-1" aria-label={`平均評価 ${averageRating}`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={`avg-star-${star}`}
                          className={`h-5 w-5 ${
                            star <= Math.round(Number(averageRating))
                              ? "fill-primary text-primary"
                              : "fill-transparent text-neutral-300 dark:text-muted-foreground/50"
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-neutral-400 dark:text-muted-foreground">{reviewCount}件の評価</p>
                  </div>

                  <div className="space-y-3 pt-1 md:flex md:h-[176px] md:flex-col md:justify-between md:space-y-0 md:pt-0">
                    {STAR_LEVELS.map((stars) => {
                      const count = ratingDistribution[stars]
                      const percentage = graphDenominator > 0 ? Math.round((count / graphDenominator) * 100) : 0
                      const barColor = "#e64a19"
                      const selected = selectedReviewStars === stars
                      return (
                        <div key={stars} className="flex items-center gap-3 text-sm">
                          <div className="w-10 shrink-0 text-neutral-500 dark:text-muted-foreground">星{stars}</div>
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/15 md:h-3">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${percentage}%`, backgroundColor: barColor }}
                              aria-hidden
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedReviewStars((prev) => (prev === stars ? null : stars))}
                            className={`min-w-14 text-left transition-colors ${
                              selected
                                ? "font-bold text-primary-readable"
                                : "text-neutral-400 hover:text-foreground dark:text-muted-foreground"
                            }`}
                            aria-pressed={selected}
                          >
                            {count}人
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <StoreEmptyPlaceholder>まだ評価はありません。</StoreEmptyPlaceholder>
                </div>
              )}

              <div className="mt-8 border-t border-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-foreground">評価コメント</h3>
                  {selectedReviewStars != null ? (
                    <button
                      type="button"
                      onClick={() => setSelectedReviewStars(null)}
                      className="text-xs text-neutral-400 underline-offset-4 hover:text-foreground hover:underline dark:text-muted-foreground"
                    >
                      絞り込みを解除（星{selectedReviewStars}）
                    </button>
                  ) : null}
                </div>
                {filteredRatingComments.length === 0 ? (
                  <div className="mt-4">
                    <StoreEmptyPlaceholder>コメント付きの評価はまだありません。</StoreEmptyPlaceholder>
                  </div>
                ) : (
                  <div className="mt-4 max-h-96 w-full space-y-3 overflow-y-auto pr-1 md:max-h-none md:overflow-visible">
                    {filteredRatingComments.map((ratingComment) => {
                      const displayDate = formatRatingDate(ratingComment.createdAt)
                      return (
                        <article
                          key={ratingComment.id}
                          className="w-full rounded-xl border border-border bg-muted/30 p-4 md:p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-neutral-900 dark:text-foreground">
                              {ratingComment.senderName}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5" aria-label={`評価 ${ratingComment.rating}`}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={`${ratingComment.id}-${star}`}
                                    className={`h-3.5 w-3.5 ${
                                      star <= ratingComment.rating
                                        ? "fill-primary text-primary"
                                        : "fill-transparent text-neutral-300 dark:text-muted-foreground/50"
                                    }`}
                                    aria-hidden
                                  />
                                ))}
                              </div>
                              {displayDate ? (
                                <span className="text-xs text-neutral-400 dark:text-muted-foreground">{displayDate}</span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-relaxed text-neutral-600 dark:text-muted-foreground">
                            {ratingComment.comment}
                          </p>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-center border-t border-border pt-8">
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="text-xs text-neutral-400 underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-muted-foreground"
              >
                このユーザーを通報する
              </button>
            </div>
          </div>
        </div>
      </main>

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        type="user"
        targetId={profile.id}
        onSuccess={(message) => setNotice({ variant: "success", message })}
      />
    </div>
  )
}
