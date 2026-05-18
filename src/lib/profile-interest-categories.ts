import { normalizeProfileCategory } from "@/lib/profile-fields"
import {
  CATEGORY_SONOTA,
  FITNESS_SUB_CATEGORY_LABELS,
  PARENT_CATEGORY_LABELS,
  PARENT_FITNESS_LABEL,
  isFitnessSubCategory,
  isParentCategoryLabel,
} from "@/lib/skill-categories"

/** DB から読み込んだ profiles.category をそのまま正規化（フィルタしない） */
export function loadProfileInterestCategories(raw: unknown): string[] {
  return normalizeProfileCategory(raw)
}

/** 従来形式のフィットネス小カテゴリ（profiles.category に保存されている値） */
export function getLegacyFitnessSubCategories(categories: string[]): string[] {
  return categories.filter(isFitnessSubCategory)
}

/** 大カテゴリとして明示保存されているラベル */
export function getExplicitParentCategories(categories: string[]): string[] {
  return categories.filter(isParentCategoryLabel)
}

/** 大カテゴリのチェック状態（フィットネスは小カテゴリのみの既存データもオン扱い） */
export function isProfileParentCategorySelected(
  categories: string[],
  parentLabel: string,
): boolean {
  if (parentLabel === PARENT_FITNESS_LABEL) {
    return (
      categories.includes(PARENT_FITNESS_LABEL) ||
      categories.some((value) => isFitnessSubCategory(value))
    )
  }
  return categories.includes(parentLabel)
}

/** 大カテゴリのトグル（フィットネスオフ時は紐づく小カテゴリも削除） */
export function toggleProfileParentCategory(
  categories: string[],
  parentLabel: string,
): string[] {
  const selected = isProfileParentCategorySelected(categories, parentLabel)

  if (parentLabel === PARENT_FITNESS_LABEL) {
    if (selected) {
      return categories.filter(
        (value) => value !== PARENT_FITNESS_LABEL && !isFitnessSubCategory(value),
      )
    }
    if (categories.includes(PARENT_FITNESS_LABEL)) {
      return categories
    }
    return [...categories, PARENT_FITNESS_LABEL]
  }

  if (selected) {
    return categories.filter((value) => value !== parentLabel)
  }
  return [...categories, parentLabel]
}

/**
 * プロフィール（ストア等）のバッジ表示用。
 * 変更前に小カテゴリのみ保存しているユーザーは、小カテゴリのバッジのみ表示する。
 * 大カテゴリ「フィットネス」のみ選択しているユーザーは「フィットネス」を表示する。
 */
export function formatProfileInterestTagsForDisplay(categories: string[]): string[] {
  const tags: string[] = []
  const legacySubs = getLegacyFitnessSubCategories(categories)
  const hasFitnessParent = categories.includes(PARENT_FITNESS_LABEL)
  const seen = new Set<string>()

  for (const label of PARENT_CATEGORY_LABELS) {
    if (label === PARENT_FITNESS_LABEL) {
      if (legacySubs.length === 0 && hasFitnessParent && !seen.has(PARENT_FITNESS_LABEL)) {
        tags.push(PARENT_FITNESS_LABEL)
        seen.add(PARENT_FITNESS_LABEL)
      }
      continue
    }
    if (categories.includes(label) && !seen.has(label)) {
      tags.push(label)
      seen.add(label)
    }
  }

  for (const sub of legacySubs) {
    if (!seen.has(sub)) {
      tags.push(sub)
      seen.add(sub)
    }
  }

  for (const value of categories) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) {
      continue
    }
    if (isParentCategoryLabel(trimmed) || isFitnessSubCategory(trimmed)) {
      continue
    }
    tags.push(trimmed)
    seen.add(trimmed)
  }

  return tags
}

export { PARENT_CATEGORY_LABELS, PARENT_FITNESS_LABEL, FITNESS_SUB_CATEGORY_LABELS, CATEGORY_SONOTA }
