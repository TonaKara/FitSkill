"use client"

import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { cn } from "@/lib/utils"

const categories = [{ id: "all", label: "すべて", icon: "🔥" }].concat(
  SKILL_CATEGORY_OPTIONS.map((category) => ({
    id: category,
    label: category,
    icon: "🏷️",
  })),
)

type CategoryFilterProps = {
  activeCategory: string
  onChange: (nextCategory: string) => void
}

export function CategoryFilter({ activeCategory, onChange }: CategoryFilterProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
              activeCategory === category.id
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            <span>{category.icon}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
