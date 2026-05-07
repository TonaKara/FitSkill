"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Star } from "lucide-react"
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
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

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
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()]
  }
  return []
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
    // 非同期ロード完了時のみ state が更新されるため、この呼び出しを許可する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <span className="ml-2 text-sm">読み込み中...</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black px-4 py-16 text-center text-zinc-200">
        <p className="text-lg font-semibold text-white">プロフィールが見つかりません</p>
        <Button asChild className="mt-8 bg-red-600 text-white hover:bg-red-500">
          <Link href="/">ホームへ戻る</Link>
        </Button>
      </div>
    )
  }

  const name = profile.display_name?.trim() || "ユーザー"
  const avatarSrc = resolveProfileAvatarUrl(profile.avatar_url, name)
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
  const fitnessText = profile.fitness_history?.trim() ?? ""

  const cardSkills = skills.map((row) =>
    mapSkillRowToCardSkillWithInstructor(row, {
      name,
      imageUrl: avatarSrc,
    }),
  )

  return (
    <div className="min-h-screen bg-black pb-20 pt-8 text-zinc-100">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <Button
          asChild
          variant="outline"
          className="mb-8 border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
        >
          <Link href="/" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            ホームへ
          </Link>
        </Button>

        {/* ヘッダー */}
        <header className="overflow-hidden rounded-2xl border border-red-500/30 bg-zinc-950 p-8 shadow-[0_0_60px_rgba(198,40,40,0.15)] md:flex md:items-center md:gap-8 md:p-10">
          <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-full ring-2 ring-red-500/40 md:mx-0 md:h-32 md:w-32">
            <Image src={avatarSrc} alt="" fill className="object-cover" unoptimized sizes="128px" />
          </div>
          <div className="mt-6 min-w-0 flex-1 text-center md:mt-0 md:text-left">
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">{name}</h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {hasRating ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-950/40 px-3 py-1 text-sm text-zinc-200">
                    <Star className="h-4 w-4 fill-red-500 text-red-500" aria-hidden />
                    <span className="font-bold text-white">{Number(profile.rating_avg).toFixed(1)}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-400">レビュー {profile.review_count} 件</span>
                  </span>
                </>
              ) : (
                <span className="text-sm text-zinc-500">評価なし</span>
              )}
            </div>
            {categoryTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                {categoryTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-red-500/40 bg-black/40 text-xs font-medium text-red-200"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {/* 自己紹介 */}
        <div className="mt-10 space-y-6">
          {bioText ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">自己紹介</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{bioText}</p>
            </section>
          ) : null}
          {fitnessText ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 md:p-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">フィットネス歴</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{fitnessText}</p>
            </section>
          ) : null}
          {!bioText && !fitnessText ? (
            <p className="text-center text-sm text-zinc-500">まだプロフィール文が登録されていません。</p>
          ) : null}
        </div>

        {/* 出品中のスキル */}
        <section className="mt-12">
          <h2 className="mb-6 text-xl font-bold text-white md:text-2xl">出品中のスキル</h2>
          {skillsError ? (
            <p className="text-sm text-zinc-500">{skillsError}</p>
          ) : cardSkills.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 py-12 text-center text-sm text-zinc-500">
              出品中のスキルはありません。
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardSkills.map((skill) => (
                <SkillCard key={String(skill.id)} favoriteSkillId={String(skill.id)} skill={skill} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 md:p-8">
          <h2 className="text-xl font-bold text-white md:text-2xl">評価</h2>
          {graphDenominator > 0 ? (
            <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr] md:items-center">
              <div className="rounded-xl border border-red-500/25 bg-zinc-900/60 p-5 md:flex md:h-[176px] md:flex-col md:justify-center">
                <p className="text-xs font-semibold tracking-wide text-zinc-400">平均評価</p>
                <p className="mt-2 text-6xl font-black leading-none text-white">{averageRating}</p>
                <div className="mt-3 flex items-center gap-1" aria-label={`平均評価 ${averageRating}`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={`avg-star-${star}`}
                      className={`h-5 w-5 ${
                        star <= Math.round(Number(averageRating))
                          ? "fill-red-500 text-red-500"
                          : "fill-transparent text-zinc-600"
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-zinc-400">{reviewCount}件の評価</p>
              </div>

              <div className="space-y-3 pt-1 md:flex md:h-[176px] md:flex-col md:justify-between md:space-y-0 md:pt-0">
                {STAR_LEVELS.map((stars) => {
                  const count = ratingDistribution[stars]
                  const percentage = graphDenominator > 0 ? Math.round((count / graphDenominator) * 100) : 0
                  const barColor = "#c62828"
                  const selected = selectedReviewStars === stars
                  return (
                    <div key={stars} className="flex items-center gap-3 text-sm">
                      <div className="w-10 shrink-0 text-zinc-300">星{stars}</div>
                      <div className="h-2.5 w-36 overflow-hidden rounded-full bg-zinc-800 md:h-3 md:w-52">
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
                          selected ? "font-bold text-red-400" : "text-zinc-400 hover:text-zinc-100"
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
            <p className="mt-4 text-sm text-zinc-500">まだ評価がありません。</p>
          )}

          <div className="mt-8 border-t border-zinc-800 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">評価コメント</h3>
              {selectedReviewStars != null ? (
                <button
                  type="button"
                  onClick={() => setSelectedReviewStars(null)}
                  className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
                >
                  絞り込みを解除（星{selectedReviewStars}）
                </button>
              ) : null}
            </div>
            {filteredRatingComments.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">コメント付きの評価はまだありません。</p>
            ) : (
              <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                {filteredRatingComments.map((ratingComment) => {
                  const displayDate = formatRatingDate(ratingComment.createdAt)
                  return (
                    <article key={ratingComment.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{ratingComment.senderName}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5" aria-label={`評価 ${ratingComment.rating}`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={`${ratingComment.id}-${star}`}
                                className={`h-3.5 w-3.5 ${
                                  star <= ratingComment.rating
                                    ? "fill-red-500 text-red-500"
                                    : "fill-transparent text-zinc-600"
                                }`}
                                aria-hidden
                              />
                            ))}
                          </div>
                          {displayDate ? <span className="text-xs text-zinc-500">{displayDate}</span> : null}
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                        {ratingComment.comment}
                      </p>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <div className="mt-16 flex justify-center border-t border-zinc-900 pt-10">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
          >
            このユーザーを通報する
          </button>
        </div>
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          type="user"
          targetId={profile.id}
          onSuccess={(message) => setNotice({ variant: "success", message })}
        />
      </div>
    </div>
  )
}
