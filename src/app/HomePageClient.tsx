"use client"

import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { LogoutSuccessToast } from "@/components/logout-success-toast"
import { HeroBanner } from "@/components/hero-banner"
import { DEFAULT_HOME_SKILL_FILTERS, SKILL_SORT_OPTIONS, SkillGrid, type SkillSortOptionId } from "@/components/skill-grid"
import { BottomNav } from "@/components/bottom-nav"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { PREFECTURE_OPTIONS } from "@/lib/prefectures"
import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { consumeHomeListScrollY } from "@/lib/home-list-scroll"

type HeroStats = {
  isAdmin: boolean
  skillsCount: number
  usersCount: number
}

type HomePageClientProps = {
  heroStats: HeroStats | null
}

export default function HomePageClient({ heroStats }: HomePageClientProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<SkillSortOptionId>("popular")
  const [filters, setFilters] = useState(DEFAULT_HOME_SKILL_FILTERS)
  const [minDurationInput, setMinDurationInput] = useState("")
  const [maxDurationInput, setMaxDurationInput] = useState("")
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    void (async () => {
      const { data, error } = await supabase.storage.listBuckets()
      console.log("実際に認識されているバケット一覧:", data)
      console.log("エラーがあれば表示:", error)
    })()
  }, [])

  useLayoutEffect(() => {
    const y = consumeHomeListScrollY()
    if (y == null) {
      return
    }
    const apply = () => {
      window.scrollTo({ top: y, left: 0, behavior: "auto" })
    }
    apply()
    requestAnimationFrame(apply)
    const t0 = window.setTimeout(apply, 0)
    const t1 = window.setTimeout(apply, 120)
    const t2 = window.setTimeout(apply, 400)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  const isLocationFilterVisible = filters.format === "onsite"
  const durationValidationMessage = useMemo(() => {
    if (
      filters.minDurationMinutes != null &&
      filters.maxDurationMinutes != null &&
      filters.minDurationMinutes > filters.maxDurationMinutes
    ) {
      return "最小時間は最大時間以下で入力してください。"
    }
    return ""
  }, [filters.maxDurationMinutes, filters.minDurationMinutes])
  const priceValidationMessage = useMemo(() => {
    if (filters.minPrice != null && filters.maxPrice != null && filters.minPrice > filters.maxPrice) {
      return "最低価格は最高価格以下で入力してください。"
    }
    return ""
  }, [filters.maxPrice, filters.minPrice])

  const handlePriceChange = (value: string, kind: "min" | "max") => {
    const normalized = value.replace(/[^\d]/g, "")
    const parsed = normalized.length > 0 ? Number(normalized) : null
    if (kind === "min") {
      setMinPriceInput(normalized)
      setFilters((prev) => ({ ...prev, minPrice: parsed }))
      return
    }
    setMaxPriceInput(normalized)
    setFilters((prev) => ({ ...prev, maxPrice: parsed }))
  }

  const handleDurationChange = (value: string, kind: "min" | "max") => {
    const normalized = value.replace(/[^\d]/g, "")
    const parsed = normalized.length > 0 ? Number(normalized) : null
    if (kind === "min") {
      setMinDurationInput(normalized)
      setFilters((prev) => ({ ...prev, minDurationMinutes: parsed }))
      return
    }
    setMaxDurationInput(normalized)
    setFilters((prev) => ({ ...prev, maxDurationMinutes: parsed }))
  }

  const handleBrowseSkillsClick = () => {
    const listSection = document.getElementById("home-skill-list-section")
    if (!listSection) {
      return
    }
    listSection.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <LogoutSuccessToast />
      <Header searchKeyword={searchKeyword} onSearchKeywordChange={setSearchKeyword} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-8">
          <HeroBanner onBrowseSkillsClick={handleBrowseSkillsClick} heroStats={heroStats} />
        </div>

        <div id="home-skill-list-section" className="mb-6 scroll-mt-20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground md:text-2xl">スキル一覧</h2>
              <p className="mt-1 text-sm text-muted-foreground">あなたにぴったりのフィットネススキルを見つけよう</p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Button variant="outline" className="border-border hover:bg-secondary" onClick={() => setShowFilters(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                フィルター
              </Button>
              <select
                aria-label="並べ替え"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SkillSortOptionId)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-secondary"
              >
                {SKILL_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
          <Button variant="outline" size="sm" className="flex-1 border-border" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            フィルター
          </Button>
          <select
            aria-label="並べ替え"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SkillSortOptionId)}
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {SKILL_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <SkillGrid filters={filters} sortBy={sortBy} searchKeyword={searchKeyword} />

        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            className="border-primary text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            もっと見る
          </Button>
        </div>
      </main>

      {showFilters ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4" onClick={() => setShowFilters(false)}>
          <section
            className="mx-auto mt-8 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-4 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">フィルター</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} aria-label="閉じる">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="category-filter" className="text-sm font-semibold text-foreground">
                  カテゴリ
                </label>
                <select
                  id="category-filter"
                  value={filters.category}
                  onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">すべて</option>
                  {SKILL_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="pre-offer-filter" className="text-sm font-semibold text-foreground">
                  事前オファー
                </label>
                <select
                  id="pre-offer-filter"
                  value={filters.preOffer}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      preOffer: event.target.value as "all" | "enabled" | "disabled",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">すべて</option>
                  <option value="enabled">あり</option>
                  <option value="disabled">なし</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">実施形式</p>
                <select
                  id="format-filter"
                  value={filters.format}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      format: event.target.value as "all" | "online" | "onsite",
                      locationPrefecture: event.target.value === "onsite" ? prev.locationPrefecture : "",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">すべて</option>
                  <option value="online">オンライン</option>
                  <option value="onsite">対面</option>
                </select>
              </div>

              {isLocationFilterVisible ? (
                <div className="space-y-2">
                  <label htmlFor="location-filter" className="text-sm font-semibold text-foreground">
                    実施場所
                  </label>
                  <select
                    id="location-filter"
                    value={filters.locationPrefecture}
                    onChange={(event) => setFilters((prev) => ({ ...prev, locationPrefecture: event.target.value }))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  >
                    <option value="">都道府県を選択</option>
                    {PREFECTURE_OPTIONS.map((prefecture) => (
                      <option key={prefecture} value={prefecture}>
                        {prefecture}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="availability-filter" className="text-sm font-semibold text-foreground">
                  対応状況
                </label>
                <select
                  id="availability-filter"
                  value={filters.availability}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      availability: event.target.value as "all" | "available" | "full",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">すべて</option>
                  <option value="available">対応可能</option>
                  <option value="full">満枠対応中</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">1回当たりの時間</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={minDurationInput}
                    onChange={(event) => handleDurationChange(event.target.value, "min")}
                    placeholder="最小時間（分）"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={maxDurationInput}
                    onChange={(event) => handleDurationChange(event.target.value, "max")}
                    placeholder="最大時間（分）"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {durationValidationMessage ? <p className="text-xs text-red-500">{durationValidationMessage}</p> : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">価格（円）</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={minPriceInput}
                    onChange={(event) => handlePriceChange(event.target.value, "min")}
                    placeholder="最低価格"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={maxPriceInput}
                    onChange={(event) => handlePriceChange(event.target.value, "max")}
                    placeholder="最高価格"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {priceValidationMessage ? <p className="text-xs text-red-500">{priceValidationMessage}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters(DEFAULT_HOME_SKILL_FILTERS)
                  setMinDurationInput("")
                  setMaxDurationInput("")
                  setMinPriceInput("")
                  setMaxPriceInput("")
                }}
              >
                リセット
              </Button>
              <Button onClick={() => setShowFilters(false)}>適用して閉じる</Button>
            </div>
          </section>
        </div>
      ) : null}

      <BottomNav />
    </div>
  )
}
