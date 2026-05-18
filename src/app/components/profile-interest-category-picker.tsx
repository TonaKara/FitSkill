"use client"

import {
  isProfileParentCategorySelected,
  PARENT_CATEGORY_LABELS,
  toggleProfileParentCategory,
} from "@/lib/profile-interest-categories"

type ProfileInterestCategoryPickerProps = {
  selectedCategories: string[]
  onChange: (next: string[]) => void
  idPrefix?: string
}

export function ProfileInterestCategoryPicker({
  selectedCategories,
  onChange,
  idPrefix = "profile-interest",
}: ProfileInterestCategoryPickerProps) {
  const handleToggle = (parentLabel: string) => {
    onChange(toggleProfileParentCategory(selectedCategories, parentLabel))
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PARENT_CATEGORY_LABELS.map((parentLabel) => {
        const id = `${idPrefix}-${parentLabel}`
        const checked = isProfileParentCategorySelected(selectedCategories, parentLabel)

        return (
          <li key={parentLabel} className="min-w-0">
            <label
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                checked
                  ? "border-primary/60 bg-primary/15"
                  : "border-border bg-muted/50 hover:border-primary/40"
              }`}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(parentLabel)}
                className="h-4 w-4 shrink-0 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 focus:ring-offset-background"
              />
              <span className="text-sm text-foreground">{parentLabel}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
