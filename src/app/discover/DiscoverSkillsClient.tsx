"use client"

import { useLayoutEffect, useMemo, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import {
  DEFAULT_HOME_SKILL_FILTERS,
  SKILL_SORT_OPTIONS,
  SkillGrid,
  type SkillSortOptionId,
} from "@/components/skill-grid"
import { Button } from "@/components/ui/button"
import { useDiscoverSearch } from "@/lib/discover-search-context"
import { PREFECTURE_OPTIONS } from "@/lib/prefectures"
import {
  FITNESS_SUB_CATEGORY_LABELS,
  PARENT_CATEGORY_LABELS,
  PARENT_FITNESS_LABEL,
  localizeStoredCategory,
} from "@/lib/skill-categories"
import { consumeHomeListScrollY } from "@/lib/home-list-scroll"
import { useLocale, useTranslations, useTranslationsWithFallback } from "@/lib/i18n/useI18n"

export default function DiscoverSkillsClient() {
  const discoverSearch = useDiscoverSearch()
  const searchKeyword = discoverSearch?.keyword ?? ""
  const locale = useLocale()
  const tDiscover = useTranslations("discover")
  const tCommon = useTranslations("common")
  const tCategories = useTranslations("categories")
  const tSortOption = useTranslationsWithFallback("sortOptions")

  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<SkillSortOptionId>("popular")
  const [filters, setFilters] = useState(DEFAULT_HOME_SKILL_FILTERS)
  const [minDurationInput, setMinDurationInput] = useState("")
  const [maxDurationInput, setMaxDurationInput] = useState("")
  const [minPriceInput, setMinPriceInput] = useState("")
  const [maxPriceInput, setMaxPriceInput] = useState("")

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
      return tDiscover("durationValidation")
    }
    return ""
  }, [filters.maxDurationMinutes, filters.minDurationMinutes, tDiscover])
  const priceValidationMessage = useMemo(() => {
    if (filters.minPrice != null && filters.maxPrice != null && filters.minPrice > filters.maxPrice) {
      return tDiscover("priceValidation")
    }
    return ""
  }, [filters.maxPrice, filters.minPrice, tDiscover])

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

  const resetFilters = () => {
    setFilters(DEFAULT_HOME_SKILL_FILTERS)
    setMinDurationInput("")
    setMaxDurationInput("")
    setMinPriceInput("")
    setMaxPriceInput("")
  }

  return (
    <div className="min-w-0 w-full bg-background">
      <main className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-4 md:max-w-6xl md:px-8 md:pb-8 md:pt-6">
        <div id="discover-skill-list-section" className="mb-6 scroll-mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground md:text-2xl">{tDiscover("title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{tDiscover("subtitle")}</p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Button variant="outline" className="border-border hover:bg-secondary" onClick={() => setShowFilters(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden />
                {tDiscover("filtersButton")}
              </Button>
              <select
                aria-label={tDiscover("sortAria")}
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SkillSortOptionId)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-secondary"
              >
                {SKILL_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {tSortOption(option.id, option.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
          <Button variant="outline" size="sm" className="flex-1 border-border" onClick={() => setShowFilters(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden />
            {tDiscover("filtersButton")}
          </Button>
          <select
            aria-label={tDiscover("sortAria")}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SkillSortOptionId)}
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {SKILL_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {tSortOption(option.id, option.label)}
              </option>
            ))}
          </select>
        </div>

        <SkillGrid filters={filters} sortBy={sortBy} searchKeyword={searchKeyword} />
      </main>

      {showFilters ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4" onClick={() => setShowFilters(false)}>
          <section
            className="mx-auto mt-8 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-4 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{tDiscover("modalTitle")}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} aria-label={tCommon("close")}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="parent-category-filter" className="text-sm font-semibold text-foreground">
                  {tDiscover("parentCategoryLabel")}
                </label>
                <select
                  id="parent-category-filter"
                  value={filters.parentCategory}
                  onChange={(event) => {
                    const parentCategory = event.target.value
                    setFilters((prev) => ({
                      ...prev,
                      parentCategory,
                      subCategory: parentCategory === PARENT_FITNESS_LABEL ? prev.subCategory : "all",
                    }))
                  }}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">{tCategories("all")}</option>
                  {PARENT_CATEGORY_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {localizeStoredCategory(label, locale)}
                    </option>
                  ))}
                </select>
              </div>

              {filters.parentCategory === PARENT_FITNESS_LABEL ? (
                <div className="space-y-2">
                  <label htmlFor="sub-category-filter" className="text-sm font-semibold text-foreground">
                    {tDiscover("subCategoryLabel")}
                  </label>
                  <select
                    id="sub-category-filter"
                    value={filters.subCategory}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, subCategory: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="all">{tCategories("all")}</option>
                    {FITNESS_SUB_CATEGORY_LABELS.map((label) => (
                      <option key={label} value={label}>
                        {localizeStoredCategory(label, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="pre-offer-filter" className="text-sm font-semibold text-foreground">
                  {tDiscover("preOfferLabel")}
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
                  <option value="all">{tCategories("all")}</option>
                  <option value="enabled">{tDiscover("preOfferEnabled")}</option>
                  <option value="disabled">{tDiscover("preOfferDisabled")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{tDiscover("formatLabel")}</p>
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
                  <option value="all">{tCategories("all")}</option>
                  <option value="online">{tDiscover("formatOnline")}</option>
                  <option value="onsite">{tDiscover("formatOnsite")}</option>
                </select>
              </div>

              {isLocationFilterVisible ? (
                <div className="space-y-2">
                  <label htmlFor="location-filter" className="text-sm font-semibold text-foreground">
                    {tDiscover("locationLabel")}
                  </label>
                  <select
                    id="location-filter"
                    value={filters.locationPrefecture}
                    onChange={(event) => setFilters((prev) => ({ ...prev, locationPrefecture: event.target.value }))}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">{tDiscover("locationPlaceholder")}</option>
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
                  {tDiscover("availabilityLabel")}
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
                  <option value="all">{tCategories("all")}</option>
                  <option value="available">{tDiscover("availabilityAvailable")}</option>
                  <option value="full">{tDiscover("availabilityFull")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{tDiscover("durationLabel")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={minDurationInput}
                    onChange={(event) => handleDurationChange(event.target.value, "min")}
                    placeholder={tDiscover("minDurationPlaceholder")}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={maxDurationInput}
                    onChange={(event) => handleDurationChange(event.target.value, "max")}
                    placeholder={tDiscover("maxDurationPlaceholder")}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {durationValidationMessage ? <p className="text-xs text-red-500">{durationValidationMessage}</p> : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{tDiscover("priceLabel")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={minPriceInput}
                    onChange={(event) => handlePriceChange(event.target.value, "min")}
                    placeholder={tDiscover("minPricePlaceholder")}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={maxPriceInput}
                    onChange={(event) => handlePriceChange(event.target.value, "max")}
                    placeholder={tDiscover("maxPricePlaceholder")}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {priceValidationMessage ? <p className="text-xs text-red-500">{priceValidationMessage}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={resetFilters}>
                {tDiscover("reset")}
              </Button>
              <Button onClick={() => setShowFilters(false)}>{tDiscover("applyAndClose")}</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
