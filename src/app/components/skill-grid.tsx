"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { SkillCard } from "@/components/skill-card"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { mapSkillRowToCardSkillFromJoin } from "@/lib/map-skill-to-card"

export const SKILL_SORT_OPTIONS = [
  { id: "popular", label: "人気順" },
  { id: "newest", label: "新しい順" },
  { id: "oldest", label: "古い順" },
  { id: "price_asc", label: "価格が低い順" },
  { id: "price_desc", label: "価格が高い順" },
  { id: "rating_desc", label: "講師の評価が高い順" },
  { id: "rating_asc", label: "講師の評価が低い順" },
  { id: "review_count_desc", label: "講師の評価件数が多い順" },
  { id: "review_count_asc", label: "講師の評価件数が少ない順" },
  { id: "duration_asc", label: "1回あたりの時間が短い順" },
  { id: "duration_desc", label: "1回あたりの時間が長い順" },
] as const

export type SkillSortOptionId = (typeof SKILL_SORT_OPTIONS)[number]["id"]

export type HomeSkillFilters = {
  category: string
  preOffer: "all" | "enabled" | "disabled"
  format: "all" | "online" | "onsite"
  availability: "all" | "available" | "full"
  locationPrefecture: string
  minDurationMinutes: number | null
  maxDurationMinutes: number | null
  minPrice: number | null
  maxPrice: number | null
}

export const DEFAULT_HOME_SKILL_FILTERS: HomeSkillFilters = {
  category: "all",
  preOffer: "all",
  format: "all",
  availability: "all",
  locationPrefecture: "",
  minDurationMinutes: null,
  maxDurationMinutes: null,
  minPrice: null,
  maxPrice: null,
}

/** デザイン用の静的サンプル（常に「古い」側として並べる） */
const DEMO_SKILLS = [
  {
    id: 1,
    title: "初心者から始める本格筋トレ｜3ヶ月で理想のボディを手に入れる",
    instructor: "田中 健太",
    instructorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    category: "筋トレ",
    rating: 4.9,
    reviewCount: 328,
    price: 5000,
    duration_minutes: 60,
    duration: "60分",
    format: "onsite",
    location_prefecture: "東京都",
    students: 5,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop",
    isPopular: true,
  },
  {
    id: 2,
    title: "朝ヨガで心と体をリフレッシュ｜柔軟性アップ＆ストレス解消",
    instructor: "鈴木 美咲",
    instructorImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    category: "ヨガ",
    rating: 4.8,
    reviewCount: 215,
    price: 3500,
    duration_minutes: 45,
    duration: "45分",
    format: "online",
    location_prefecture: null,
    students: 10,
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=500&fit=crop",
    isNew: true,
  },
  {
    id: 3,
    title: "ボクシングフィットネス｜脂肪燃焼＆ストレス発散",
    instructor: "山田 翔太",
    instructorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    category: "格闘技",
    rating: 4.9,
    reviewCount: 187,
    price: 6000,
    duration_minutes: 50,
    duration: "50分",
    format: "onsite",
    location_prefecture: "大阪府",
    students: 2,
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&h=500&fit=crop",
    isPopular: true,
  },
  {
    id: 4,
    title: "HIITで効率的に脂肪燃焼｜1日20分の高強度トレーニング",
    instructor: "佐藤 理恵",
    instructorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    category: "ダイエット",
    rating: 4.7,
    reviewCount: 412,
    price: 4000,
    duration_minutes: 30,
    duration: "30分",
    format: "online",
    location_prefecture: null,
    students: 3,
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=500&fit=crop",
  },
  {
    id: 5,
    title: "マラソン完走を目指す！初心者ランニング講座",
    instructor: "高橋 誠",
    instructorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    category: "ランニング",
    rating: 4.8,
    reviewCount: 156,
    price: 4500,
    duration_minutes: 60,
    duration: "60分",
    format: "onsite",
    location_prefecture: "神奈川県",
    students: 20,
    image: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=500&fit=crop",
    isNew: true,
  },
  {
    id: 6,
    title: "デスクワーカーのための肩こり解消ストレッチ",
    instructor: "中村 あゆみ",
    instructorImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    category: "ストレッチ",
    rating: 4.6,
    reviewCount: 289,
    price: 3000,
    duration_minutes: 40,
    duration: "40分",
    format: "online",
    location_prefecture: null,
    students: 10,
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=500&fit=crop",
  },
  {
    id: 7,
    title: "自宅でできる本格ダンスフィットネス｜K-POP編",
    instructor: "李 ユナ",
    instructorImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    category: "ダンス",
    rating: 4.9,
    reviewCount: 523,
    price: 3500,
    duration_minutes: 45,
    duration: "45分",
    format: "online",
    location_prefecture: null,
    students: 15,
    image: "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=800&h=500&fit=crop",
    isPopular: true,
  },
  {
    id: 8,
    title: "上級者向け筋肥大プログラム｜科学的アプローチ",
    instructor: "木村 大輔",
    instructorImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    category: "筋トレ",
    rating: 4.8,
    reviewCount: 178,
    price: 8000,
    duration_minutes: 90,
    duration: "90分",
    format: "onsite",
    location_prefecture: "福岡県",
    students: 1,
    image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=500&fit=crop",
  },
] as const

type ProfileEmbed = {
  display_name: string | null
  rating_avg: number | null
  review_count: number | null
  is_banned?: boolean | null
}

type ConsultationSettingsEmbed = { is_enabled: boolean | null } | { is_enabled: boolean | null }[] | null

type SkillFromDb = {
  id: string
  user_id: string
  title: string
  description: string
  target_audience: string
  category: string
  price: number
  duration_minutes: number
  format: "online" | "onsite"
  location_prefecture: string | null
  max_capacity: number
  created_at: string
  thumbnail_url: string | null
  profiles: ProfileEmbed | ProfileEmbed[] | null
  /** skills → consultation_settings（1:1）。取得に失敗・未設定の場合は null / 省略 */
  consultation_settings?: ConsultationSettingsEmbed
}

function isConsultationPreOfferEnabled(embedded: ConsultationSettingsEmbed | undefined): boolean {
  if (embedded == null) {
    return false
  }
  if (Array.isArray(embedded)) {
    return embedded.some((row) => row?.is_enabled === true)
  }
  return embedded.is_enabled === true
}

type SkillFilterInput = {
  category: string
  hasConsultationOffer: boolean
  price: number
  durationMinutes: number
  format: "online" | "onsite"
  locationPrefecture: string | null
  maxCapacity: number
  ongoingApplications: number
  searchText: string
}

function matchesFilters(item: SkillFilterInput, filters: HomeSkillFilters): boolean {
  if (filters.category !== "all" && item.category !== filters.category) {
    return false
  }
  if (filters.preOffer === "enabled" && !item.hasConsultationOffer) {
    return false
  }
  if (filters.preOffer === "disabled" && item.hasConsultationOffer) {
    return false
  }

  if (filters.format !== "all" && item.format !== filters.format) {
    return false
  }

  const isFull = item.maxCapacity > 0 && item.ongoingApplications >= item.maxCapacity
  if (filters.availability === "available" && isFull) {
    return false
  }
  if (filters.availability === "full" && !isFull) {
    return false
  }

  const locationPrefecture = filters.locationPrefecture.trim()
  if (locationPrefecture.length > 0) {
    if (item.format !== "onsite") {
      return false
    }
    const locationLabel = item.locationPrefecture?.trim() ?? ""
    if (locationLabel !== locationPrefecture) {
      return false
    }
  }

  const minDuration = filters.minDurationMinutes
  const maxDuration = filters.maxDurationMinutes
  const effectiveMinDuration =
    minDuration != null && maxDuration != null ? Math.min(minDuration, maxDuration) : minDuration
  const effectiveMaxDuration =
    minDuration != null && maxDuration != null ? Math.max(minDuration, maxDuration) : maxDuration

  if (effectiveMinDuration != null && item.durationMinutes < effectiveMinDuration) {
    return false
  }
  if (effectiveMaxDuration != null && item.durationMinutes > effectiveMaxDuration) {
    return false
  }
  const minPrice = filters.minPrice
  const maxPrice = filters.maxPrice
  const effectiveMin = minPrice != null && maxPrice != null ? Math.min(minPrice, maxPrice) : minPrice
  const effectiveMax = minPrice != null && maxPrice != null ? Math.max(minPrice, maxPrice) : maxPrice

  if (effectiveMin != null && item.price < effectiveMin) {
    return false
  }
  if (effectiveMax != null && item.price > effectiveMax) {
    return false
  }
  return true
}

function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
}

function matchesSearchKeyword(searchText: string, searchKeyword: string): boolean {
  const normalizedKeyword = normalizeForSearch(searchKeyword).trim()
  if (!normalizedKeyword) {
    return true
  }
  const normalizedText = normalizeForSearch(searchText)
  const keywords = normalizedKeyword.split(/[\s\u3000]+/).filter((v) => v.length > 0)
  if (keywords.length === 0) {
    return true
  }
  // 複数語は AND 条件（すべての語を含む場合にヒット）
  return keywords.every((keyword) => normalizedText.includes(keyword))
}

type SkillGridProps = {
  filters: HomeSkillFilters
  sortBy: SkillSortOptionId
  searchKeyword: string
}

type SkillListItem = {
  key: string
  favoriteSkillId?: string
  skill: Parameters<typeof SkillCard>[0]["skill"]
  filterInput: SkillFilterInput
  sortMeta: {
    favoritesCount: number
    createdAtMs: number
    price: number
    rating: number
    reviewCount: number
    durationMinutes: number
  }
}

function getProfileFromJoin(profiles: ProfileEmbed | ProfileEmbed[] | null): ProfileEmbed | null {
  if (!profiles) {
    return null
  }
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
}

function isMissingBannedColumnError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return normalized.includes("is_banned") && (normalized.includes("could not find") || normalized.includes("does not exist"))
}

function isRelationSelectError(message: string): boolean {
  const normalized = String(message ?? "").toLowerCase()
  return (
    normalized.includes("consultation_settings") ||
    normalized.includes("profiles") ||
    normalized.includes("relationship") ||
    normalized.includes("foreign key")
  )
}

function sortSkillItems(items: SkillListItem[], sortBy: SkillSortOptionId): SkillListItem[] {
  const sorted = [...items]
  sorted.sort((a, b) => {
    const aMeta = a.sortMeta
    const bMeta = b.sortMeta
    if (sortBy === "popular") {
      return bMeta.favoritesCount - aMeta.favoritesCount || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "newest") {
      return bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "oldest") {
      return aMeta.createdAtMs - bMeta.createdAtMs
    }
    if (sortBy === "price_asc") {
      return aMeta.price - bMeta.price || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "price_desc") {
      return bMeta.price - aMeta.price || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "rating_desc") {
      return bMeta.rating - aMeta.rating || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "rating_asc") {
      return aMeta.rating - bMeta.rating || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "review_count_desc") {
      return bMeta.reviewCount - aMeta.reviewCount || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "review_count_asc") {
      return aMeta.reviewCount - bMeta.reviewCount || bMeta.createdAtMs - aMeta.createdAtMs
    }
    if (sortBy === "duration_asc") {
      return aMeta.durationMinutes - bMeta.durationMinutes || bMeta.createdAtMs - aMeta.createdAtMs
    }
    return bMeta.durationMinutes - aMeta.durationMinutes || bMeta.createdAtMs - aMeta.createdAtMs
  })
  return sorted
}

export function SkillGrid({ filters, sortBy, searchKeyword }: SkillGridProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [rows, setRows] = useState<SkillFromDb[]>([])
  const [ongoingApplicationCountBySkill, setOngoingApplicationCountBySkill] = useState<Record<string, number>>({})
  const [favoriteCountBySkill, setFavoriteCountBySkill] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setErrorMessage(null)

      const primaryQuery = await supabase
        .from("skills")
        .select(
          "id, title, description, target_audience, category, price, duration_minutes, format, location_prefecture, max_capacity, created_at, thumbnail_url, user_id, profiles ( display_name, rating_avg, review_count, is_banned ), consultation_settings ( is_enabled )",
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
      let queryData: unknown[] | null = (primaryQuery.data as unknown[] | null) ?? null
      let queryError = primaryQuery.error

      if (queryError && isMissingBannedColumnError(queryError.message)) {
        const fallbackQuery = await supabase
          .from("skills")
          .select(
            "id, title, description, target_audience, category, price, duration_minutes, format, location_prefecture, max_capacity, created_at, thumbnail_url, user_id, profiles ( display_name, rating_avg, review_count ), consultation_settings ( is_enabled )",
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false })
        queryData = (fallbackQuery.data as unknown[] | null) ?? null
        queryError = fallbackQuery.error
      }

      if (queryError && isRelationSelectError(queryError.message)) {
        const plainSkillsQuery = await supabase
          .from("skills")
          .select(
            "id, title, description, target_audience, category, price, duration_minutes, format, location_prefecture, max_capacity, created_at, thumbnail_url, user_id",
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false })

        if (!plainSkillsQuery.error) {
          const plainRows = (plainSkillsQuery.data ?? []) as Array<Omit<SkillFromDb, "profiles" | "consultation_settings">>
          const userIds = [...new Set(plainRows.map((row) => String(row.user_id)).filter((id) => id.length > 0))]
          const skillIds = plainRows.map((row) => String(row.id)).filter((id) => id.length > 0)

          let profileById: Record<string, ProfileEmbed> = {}
          if (userIds.length > 0) {
            const profilePrimary = await supabase
              .from("profiles")
              .select("id, display_name, rating_avg, review_count, is_banned")
              .in("id", userIds)
            let profileRows = (profilePrimary.data ?? []) as Array<
              ProfileEmbed & {
                id: string
              }
            >
            if (profilePrimary.error && isMissingBannedColumnError(profilePrimary.error.message)) {
              const profileFallback = await supabase
                .from("profiles")
                .select("id, display_name, rating_avg, review_count")
                .in("id", userIds)
              profileRows = (profileFallback.data ?? []) as Array<
                Omit<ProfileEmbed, "is_banned"> & {
                  id: string
                }
              >
            }
            profileById = profileRows.reduce<Record<string, ProfileEmbed>>((acc, row) => {
              const id = String(row.id ?? "")
              if (!id) {
                return acc
              }
              acc[id] = {
                display_name: row.display_name ?? null,
                rating_avg: row.rating_avg ?? null,
                review_count: row.review_count ?? null,
                is_banned: row.is_banned ?? null,
              }
              return acc
            }, {})
          }

          let consultationBySkillId: Record<string, ConsultationSettingsEmbed> = {}
          if (skillIds.length > 0) {
            const consultationQuery = await supabase
              .from("consultation_settings")
              .select("skill_id, is_enabled")
              .in("skill_id", skillIds)
            if (!consultationQuery.error) {
              consultationBySkillId = (consultationQuery.data ?? []).reduce<
                Record<string, ConsultationSettingsEmbed>
              >((acc, row) => {
                const typed = row as { skill_id?: string | number | null; is_enabled?: boolean | null }
                const sid = String(typed.skill_id ?? "")
                if (!sid) {
                  return acc
                }
                acc[sid] = { is_enabled: typed.is_enabled ?? null }
                return acc
              }, {})
            }
          }

          queryData = plainRows.map((row) => {
            const userId = String(row.user_id ?? "")
            const skillId = String(row.id ?? "")
            return {
              ...row,
              profiles: profileById[userId] ?? null,
              consultation_settings: consultationBySkillId[skillId] ?? null,
            }
          })
          queryError = null
        } else {
          queryError = plainSkillsQuery.error
        }
      }

      if (cancelled) {
        return
      }

      if (queryError) {
        setRows([])
        setOngoingApplicationCountBySkill({})
        setFavoriteCountBySkill({})
        setErrorMessage("スキル一覧の取得に失敗しました。")
        return
      }

      const nextRows = ((queryData ?? []) as SkillFromDb[]).filter((row) => {
        const profile = getProfileFromJoin(row.profiles)
        return profile?.is_banned !== true
      })
      setRows(nextRows)

      const skillIds = nextRows.map((row) => String(row.id)).filter((id) => id.length > 0)
      if (skillIds.length === 0) {
        setOngoingApplicationCountBySkill({})
        setFavoriteCountBySkill({})
        return
      }

      const [
        { data: txData, error: txError },
        { data: favoriteData, error: favoriteError },
      ] = await Promise.all([
        supabase.from("transactions").select("skill_id, status").in("skill_id", skillIds).neq("status", "completed"),
        supabase
          .from("skill_favorite_counts")
          .select("skill_id, favorites_count")
          .in("skill_id", skillIds),
      ])

      if (txError) {
        setOngoingApplicationCountBySkill({})
      } else {
        const countMap: Record<string, number> = {}
        for (const tx of (txData ?? []) as Array<{ skill_id: string | null }>) {
          const sid = typeof tx.skill_id === "string" ? tx.skill_id : String(tx.skill_id ?? "")
          if (!sid) {
            continue
          }
          countMap[sid] = (countMap[sid] ?? 0) + 1
        }
        setOngoingApplicationCountBySkill(countMap)
      }

      if (favoriteError) {
        setFavoriteCountBySkill({})
      } else {
        const favoriteMap: Record<string, number> = {}
        for (const row of (favoriteData ?? []) as Array<{ skill_id: string | null; favorites_count: number }>) {
          const sid = typeof row.skill_id === "string" ? row.skill_id : String(row.skill_id ?? "")
          if (!sid) {
            continue
          }
          favoriteMap[sid] = Math.max(0, Number(row.favorites_count ?? 0))
        }
        setFavoriteCountBySkill(favoriteMap)
      }
    }

    void run().finally(() => {
      if (!cancelled) {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase])

  const filteredAndSortedItems = useMemo(() => {
    const dbItems: SkillListItem[] = rows.map((row) => {
      const idKey = String(row.id)
      const profile = getProfileFromJoin(row.profiles)
      const rating = Number(profile?.rating_avg ?? 0)
      const reviewCount = Number(profile?.review_count ?? 0)
      return {
        key: idKey,
        favoriteSkillId: idKey,
        skill: mapSkillRowToCardSkillFromJoin(row),
        filterInput: {
          category: row.category,
          hasConsultationOffer: isConsultationPreOfferEnabled(row.consultation_settings),
          price: row.price,
          durationMinutes: row.duration_minutes,
          format: row.format,
          locationPrefecture: row.location_prefecture,
          maxCapacity: Math.max(0, Math.floor(Number(row.max_capacity))),
          ongoingApplications: ongoingApplicationCountBySkill[idKey] ?? 0,
          searchText: [row.title, row.description, row.target_audience].filter((v) => typeof v === "string").join(" "),
        },
        sortMeta: {
          favoritesCount: favoriteCountBySkill[idKey] ?? 0,
          createdAtMs: Number.isFinite(Date.parse(row.created_at)) ? Date.parse(row.created_at) : 0,
          price: row.price,
          rating: Number.isFinite(rating) ? rating : 0,
          reviewCount: Number.isFinite(reviewCount) ? Math.max(0, Math.floor(reviewCount)) : 0,
          durationMinutes: row.duration_minutes,
        },
      }
    })

    const demoItems: SkillListItem[] = DEMO_SKILLS.map((skill) => ({
      key: `demo-${skill.id}`,
      skill,
      filterInput: {
        category: skill.category,
        hasConsultationOffer: false,
        price: skill.price,
        durationMinutes: skill.duration_minutes,
        format: skill.format,
        locationPrefecture: skill.location_prefecture,
        maxCapacity: Math.max(0, Math.floor(Number(skill.students))),
        ongoingApplications: 0,
        searchText: skill.title,
      },
      sortMeta: {
        favoritesCount: 0,
        createdAtMs: 0,
        price: skill.price,
        rating: skill.rating,
        reviewCount: skill.reviewCount,
        durationMinutes: skill.duration_minutes,
      },
    }))

    const allItems = dbItems
      .concat(demoItems)
      .filter((item) => matchesFilters(item.filterInput, filters))
      .filter((item) => matchesSearchKeyword(item.filterInput.searchText, searchKeyword))
    return sortSkillItems(allItems, sortBy)
  }, [rows, ongoingApplicationCountBySkill, favoriteCountBySkill, filters, searchKeyword, sortBy])

  const isDefaultFilterState =
    filters.category === "all" &&
    filters.preOffer === "all" &&
    filters.format === "all" &&
    filters.availability === "all" &&
    filters.locationPrefecture.trim() === "" &&
    filters.minDurationMinutes == null &&
    filters.maxDurationMinutes == null &&
    filters.minPrice == null &&
    filters.maxPrice == null &&
    searchKeyword.trim() === ""

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-readable" aria-hidden />
        <span className="ml-2 text-sm text-muted-foreground">スキル一覧を読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorMessage ? <p className="text-sm text-muted-foreground">{errorMessage}</p> : null}
      {!isDefaultFilterState ? (
        <p className="text-sm text-muted-foreground">絞り込み結果: {filteredAndSortedItems.length}件</p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAndSortedItems.map((item) => (
          <SkillCard
            key={item.key}
            favoriteSkillId={item.favoriteSkillId}
            skill={item.skill}
            initialFavoriteCount={item.sortMeta.favoritesCount}
          />
        ))}
      </div>
    </div>
  )
}
