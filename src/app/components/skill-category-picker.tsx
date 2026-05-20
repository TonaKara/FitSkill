"use client"

import type { ReactNode } from "react"
import {
  FITNESS_SUB_CATEGORY_LABELS,
  PARENT_CATEGORY_LABELS,
  PARENT_FITNESS_LABEL,
  getStoredCategoryFromPicker,
  localizeStoredCategory,
} from "@/lib/skill-categories"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

type SkillCategoryPickerProps = {
  parentLabel: string
  subLabel: string
  onParentChange: (parent: string) => void
  onSubChange: (sub: string) => void
  parentSelectId?: string
  subSelectId?: string
  parentLabelText?: string
  subLabelText?: string
  selectClassName: string
  requiredMark?: ReactNode
  showStoredHint?: boolean
}

export function SkillCategoryPicker({
  parentLabel,
  subLabel,
  onParentChange,
  onSubChange,
  parentSelectId = "skill-parent-category",
  subSelectId = "skill-sub-category",
  parentLabelText,
  subLabelText,
  selectClassName,
  requiredMark,
  showStoredHint = false,
}: SkillCategoryPickerProps) {
  const isFitness = parentLabel === PARENT_FITNESS_LABEL
  const storedPreview =
    parentLabel.length > 0 ? getStoredCategoryFromPicker(parentLabel, subLabel) : ""
  const locale = useLocale()
  const tCategoriesUi = useTranslations("categoriesUi")
  const resolvedParentLabelText = parentLabelText ?? tCategoriesUi("parentLabel")
  const resolvedSubLabelText = subLabelText ?? tCategoriesUi("subLabel")

  const handleParentChange = (nextParent: string) => {
    onParentChange(nextParent)
    if (nextParent === PARENT_FITNESS_LABEL) {
      onSubChange(subLabel || "")
      return
    }
    onSubChange("")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={parentSelectId} className="text-sm font-semibold text-foreground">
          {resolvedParentLabelText}
          {requiredMark}
        </label>
        <select
          id={parentSelectId}
          value={parentLabel}
          onChange={(event) => handleParentChange(event.target.value)}
          className={selectClassName}
        >
          <option value="">{tCategoriesUi("selectPlaceholder")}</option>
          {PARENT_CATEGORY_LABELS.map((label) => (
            <option key={label} value={label}>
              {localizeStoredCategory(label, locale)}
            </option>
          ))}
        </select>
      </div>

      {isFitness ? (
        <div className="space-y-2">
          <label htmlFor={subSelectId} className="text-sm font-semibold text-foreground">
            {resolvedSubLabelText}
            {requiredMark}
          </label>
          <select
            id={subSelectId}
            value={subLabel}
            onChange={(event) => onSubChange(event.target.value)}
            className={selectClassName}
          >
            <option value="">{tCategoriesUi("selectPlaceholder")}</option>
            {FITNESS_SUB_CATEGORY_LABELS.map((label) => (
              <option key={label} value={label}>
                {localizeStoredCategory(label, locale)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showStoredHint && storedPreview ? (
        <p className="text-xs text-muted-foreground">
          {tCategoriesUi("storedHint")} <span className="font-medium text-foreground">{localizeStoredCategory(storedPreview, locale)}</span>
        </p>
      ) : null}
    </div>
  )
}
