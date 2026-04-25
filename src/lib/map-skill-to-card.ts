import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"

export type SkillRowForCard = {
  id: string
  title: string
  category: string
  price: number
  duration_minutes: number
  max_capacity: number
  thumbnail_url: string | null
}

type ProfileEmbed = {
  display_name: string | null
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

function instructorAvatarUrl(displayName: string): string {
  const name = displayName.trim() || "?"
  return `https://ui-avatars.com/api/?size=128&background=f3f4f6&color=171717&name=${encodeURIComponent(name)}`
}

/** SkillCard 用オブジェクト（講師情報を明示指定） */
export function mapSkillRowToCardSkillWithInstructor(
  row: SkillRowForCard,
  instructor: { name: string; imageUrl: string },
  ratingInfo?: { ratingAvg: number | null; reviewCount: number | null },
) {
  const ratingAvgRaw = Number(ratingInfo?.ratingAvg ?? 0)
  const reviewCountRaw = Number(ratingInfo?.reviewCount ?? 0)
  const rating = Number.isFinite(ratingAvgRaw) ? Math.max(0, ratingAvgRaw) : 0
  const reviewCount = Number.isFinite(reviewCountRaw) ? Math.max(0, Math.floor(reviewCountRaw)) : 0

  return {
    id: row.id,
    title: row.title,
    instructor: instructor.name,
    instructorImage: instructor.imageUrl,
    category: row.category,
    rating,
    reviewCount,
    price: row.price,
    duration: `${row.duration_minutes}分`,
    students: row.max_capacity,
    image: resolveSkillThumbnailUrl(row.thumbnail_url),
    detailHref: `/skills/${row.id}`,
  }
}

/** skills + profiles 結合行（一覧グリッド用） */
export function mapSkillRowToCardSkillFromJoin(row: SkillFromDbWithProfile) {
  const profile = normalizeProfile(row.profiles)
  const instructor = profile?.display_name?.trim() || "講師"
  return mapSkillRowToCardSkillWithInstructor(row, {
    name: instructor,
    imageUrl: instructorAvatarUrl(instructor),
  }, {
    ratingAvg: profile?.rating_avg ?? null,
    reviewCount: profile?.review_count ?? null,
  })
}
