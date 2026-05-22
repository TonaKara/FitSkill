import { type Currency, normalizeCurrency } from "@/lib/currency"
import { getProfileAvatarUrl } from "@/lib/profile-avatar"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"

export type SkillRowForCard = {
  id: string
  title: string
  category: string
  price: number
  duration_minutes: number
  max_capacity: number
  thumbnail_url: string | null
  /**
   * 行の販売通貨。DB の skills.currency 列。
   * 未指定（古い SELECT 文・既存テスト等）の場合は normalizeCurrency() で 'JPY' フォールバック。
   */
  currency?: string | null
}

type ProfileEmbed = {
  display_name: string | null
  avatar_url?: string | null
  rating_avg: number | null
  review_count: number | null
}

type SkillFromDbWithProfile = SkillRowForCard & {
  profiles: ProfileEmbed | ProfileEmbed[] | null
}

function normalizeProfile(profiles: SkillFromDbWithProfile["profiles"]): ProfileEmbed | null {
  if (!profiles) {
    return null
  }
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
}

/** SkillCard 用オブジェクト（講師情報を明示指定） */
export function mapSkillRowToCardSkillWithInstructor(
  row: SkillRowForCard,
  instructor: { name: string; avatarUrl: string | null },
  ratingInfo?: { ratingAvg: number | null; reviewCount: number | null },
) {
  const ratingAvgRaw = Number(ratingInfo?.ratingAvg ?? 0)
  const reviewCountRaw = Number(ratingInfo?.reviewCount ?? 0)
  const rating = Number.isFinite(ratingAvgRaw) ? Math.max(0, ratingAvgRaw) : 0
  const reviewCount = Number.isFinite(reviewCountRaw) ? Math.max(0, Math.floor(reviewCountRaw)) : 0

  // duration_minutes は数値列だが、稀に null/NaN が混入してもカード表示が "NaN分" にならないよう堅牢化。
  const durationMinutesRaw = Number(row.duration_minutes)
  const durationMinutes = Number.isFinite(durationMinutesRaw)
    ? Math.max(0, Math.floor(durationMinutesRaw))
    : 0

  return {
    id: row.id,
    title: row.title,
    instructor: instructor.name,
    instructorAvatarUrl: instructor.avatarUrl,
    category: row.category,
    rating,
    reviewCount,
    price: row.price,
    /**
     * 行の通貨。未指定（既存 SELECT 文が currency を fetch していない／旧データ）の
     * 場合は 'JPY' フォールバック。これにより既存呼び出しは無変更で安全に動く。
     */
    currency: normalizeCurrency(row.currency) satisfies Currency,
    duration: `${durationMinutes}分`,
    students: row.max_capacity,
    image: resolveSkillThumbnailUrl(row.thumbnail_url),
    detailHref: `/skills/${row.id}`,
  }
}

/** skills + profiles 結合行（一覧グリッド用）
 *
 * `instructor` は **DB の display_name を trim した値、または空文字** を返す。
 * 空文字のときの表示文言（locale 別「講師 / Instructor」）は SkillCard 側で
 * `tCard("instructorFallback")` を当てる責務とする。これにより EN ロケール
 * 表示時に JA「講師」がリークすることを防ぐ。
 */
export function mapSkillRowToCardSkillFromJoin(row: SkillFromDbWithProfile) {
  const profile = normalizeProfile(row.profiles)
  const instructor = profile?.display_name?.trim() ?? ""
  return mapSkillRowToCardSkillWithInstructor(row, {
    name: instructor,
    avatarUrl: getProfileAvatarUrl(profile?.avatar_url ?? null),
  }, {
    ratingAvg: profile?.rating_avg ?? null,
    reviewCount: profile?.review_count ?? null,
  })
}
