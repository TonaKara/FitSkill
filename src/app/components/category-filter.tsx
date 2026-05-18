"use client"

import {
  CATEGORY_SONOTA,
  FITNESS_SUB_CATEGORY_LABELS,
  PARENT_CATEGORY_LABELS,
  PARENT_FITNESS_LABEL,
  formatSkillCategoryDisplay,
  resolveSkillCategory,
} from "@/lib/skill-categories"
import { cn } from "@/lib/utils"

const parentCategories = [{ id: "all", label: "すべて", icon: "🔥" }].concat(
  PARENT_CATEGORY_LABELS.map((label) => ({
    id: label,
    label,
    icon: "🏷️",
  })),
)

type CategoryFilterProps = {
  activeParentCategory: string
  activeSubCategory: string
  onParentChange: (nextParent: string) => void
  onSubChange: (nextSub: string) => void
}

export function CategoryFilter({
  activeParentCategory,
  activeSubCategory,
  onParentChange,
  onSubChange,
}: CategoryFilterProps) {
  const showSubFilter = activeParentCategory === PARENT_FITNESS_LABEL

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          {parentCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                onParentChange(category.id)
                if (category.id !== PARENT_FITNESS_LABEL) {
                  onSubChange("all")
                }
              }}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
                activeParentCategory === category.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showSubFilter ? (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-2">
            <button
              type="button"
              onClick={() => onSubChange("all")}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                activeSubCategory === "all"
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              すべて
            </button>
            {FITNESS_SUB_CATEGORY_LABELS.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => onSubChange(sub)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  activeSubCategory === sub
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** カード等で stored 値から表示用ラベルを得る */
export function getCategoryFilterDisplayLabel(storedCategory: string): string {
  return formatSkillCategoryDisplay(storedCategory)
}

export function categoryMatchesFilter(
  storedCategory: string,
  activeParentCategory: string,
  activeSubCategory: string,
): boolean {
  if (activeParentCategory === "all") {
    return true
  }
  const resolved = resolveSkillCategory(storedCategory)
  if (resolved.parentLabel !== activeParentCategory) {
    return false
  }
  if (activeParentCategory !== PARENT_FITNESS_LABEL) {
    return true
  }
  if (activeSubCategory === "all") {
    return true
  }
  if (resolved.isUnknownFallback) {
    return activeSubCategory === CATEGORY_SONOTA
  }
  return resolved.subLabel === activeSubCategory
}
