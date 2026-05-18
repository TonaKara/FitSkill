/** 出品フォーム・プロフィール等で共有するカテゴリ一覧（50音順 + その他） */
export const CATEGORY_SONOTA = "その他"

export const PARENT_FITNESS_LABEL = "フィットネス"

/** 大カテゴリ（五十音順、その他は最後） */
export const PARENT_CATEGORY_LABELS = [
  PARENT_FITNESS_LABEL,
  "料理",
  "ゲーム",
  "勉強",
  "創作",
  "芸術",
  CATEGORY_SONOTA,
] as const

export type ParentCategoryLabel = (typeof PARENT_CATEGORY_LABELS)[number]

/** フィットネス配下の小カテゴリ（五十音順、その他は最後）— DB の `category` 値と一致 */
export const FITNESS_SUB_CATEGORY_LABELS = [
  "サッカー",
  "ストレッチ",
  "ダイエット",
  "ダンス",
  "バスケ",
  "バドミントン",
  "ピラティス",
  "ヨガ",
  "ランニング",
  "格闘技",
  "筋トレ",
  CATEGORY_SONOTA,
] as const

export type FitnessSubCategoryLabel = (typeof FITNESS_SUB_CATEGORY_LABELS)[number]

/** フィットネス以外の大カテゴリ（保存値は大カテゴリ名そのもの） */
export const NON_FITNESS_PARENT_LABELS = PARENT_CATEGORY_LABELS.filter(
  (label): label is Exclude<ParentCategoryLabel, typeof PARENT_FITNESS_LABEL> =>
    label !== PARENT_FITNESS_LABEL,
)

const FITNESS_SUB_SET = new Set<string>(FITNESS_SUB_CATEGORY_LABELS)
const NON_FITNESS_PARENT_SET = new Set<string>(NON_FITNESS_PARENT_LABELS)

/** 親子構造の定義（UI 用） */
export const SKILL_PARENT_CATEGORIES = {
  fitness: {
    label: PARENT_FITNESS_LABEL,
    sub: [...FITNESS_SUB_CATEGORY_LABELS],
  },
  cooking: { label: "料理", sub: [CATEGORY_SONOTA] as const },
  game: { label: "ゲーム", sub: [CATEGORY_SONOTA] as const },
  study: { label: "勉強", sub: [CATEGORY_SONOTA] as const },
  creation: { label: "創作", sub: [CATEGORY_SONOTA] as const },
  art: { label: "芸術", sub: [CATEGORY_SONOTA] as const },
  other: { label: CATEGORY_SONOTA, sub: [CATEGORY_SONOTA] as const },
} as const

/**
 * 従来の小カテゴリ一覧（プロフィールの「興味のある分野」等）。
 * DB の `skills.category` に保存されるフィットネス系の値と一致。
 */
export const SKILL_CATEGORY_OPTIONS = [...FITNESS_SUB_CATEGORY_LABELS]

export type ResolvedSkillCategory = {
  /** DB に保存されている値（正規化後） */
  storedValue: string
  parentLabel: ParentCategoryLabel | typeof CATEGORY_SONOTA
  subLabel: string | null
  displayLabel: string
  /** 既知の小カテゴリ・大カテゴリに無い値のとき true（表示・フィルタは「その他」扱い） */
  isUnknownFallback: boolean
}

export function isFitnessSubCategory(value: string): value is FitnessSubCategoryLabel {
  return FITNESS_SUB_SET.has(value)
}

export function isNonFitnessParentCategory(value: string): boolean {
  return NON_FITNESS_PARENT_SET.has(value)
}

export function isParentCategoryLabel(value: string): value is ParentCategoryLabel {
  return (PARENT_CATEGORY_LABELS as readonly string[]).includes(value)
}

/** 読み込み時のフォールバック付き分類 */
export function resolveSkillCategory(stored: string | null | undefined): ResolvedSkillCategory {
  const raw = typeof stored === "string" ? stored.trim() : ""

  if (isFitnessSubCategory(raw)) {
    return {
      storedValue: raw,
      parentLabel: PARENT_FITNESS_LABEL,
      subLabel: raw,
      displayLabel: `${PARENT_FITNESS_LABEL} > ${raw}`,
      isUnknownFallback: false,
    }
  }

  if (isNonFitnessParentCategory(raw)) {
    return {
      storedValue: raw,
      parentLabel: raw as ParentCategoryLabel,
      subLabel: null,
      displayLabel: raw,
      isUnknownFallback: false,
    }
  }

  return {
    storedValue: raw || CATEGORY_SONOTA,
    parentLabel: PARENT_FITNESS_LABEL,
    subLabel: CATEGORY_SONOTA,
    displayLabel: `${PARENT_FITNESS_LABEL} > ${CATEGORY_SONOTA}`,
    isUnknownFallback: raw.length > 0,
  }
}

export function formatSkillCategoryDisplay(stored: string | null | undefined): string {
  return resolveSkillCategory(stored).displayLabel
}

/** スキルカード等のバッジ用（小カテゴリ優先、大カテゴリのみのときは大カテゴリ名） */
export function formatSkillCategoryBadgeLabel(stored: string | null | undefined): string {
  const resolved = resolveSkillCategory(stored)
  if (resolved.subLabel) {
    return resolved.subLabel
  }
  return resolved.parentLabel
}

/** 出品フォームの大・小カテゴリ選択から DB 保存用文字列へ */
export function getStoredCategoryFromPicker(parentLabel: string, subLabel: string): string {
  if (parentLabel === PARENT_FITNESS_LABEL) {
    const sub = subLabel.trim()
    if (sub && isFitnessSubCategory(sub)) {
      return sub
    }
    return CATEGORY_SONOTA
  }
  if (isNonFitnessParentCategory(parentLabel)) {
    return parentLabel
  }
  return CATEGORY_SONOTA
}

/** DB 値から出品フォーム用の大・小カテゴリへ */
export function getPickerValuesFromStored(stored: string | null | undefined): {
  parentLabel: string
  subLabel: string
} {
  const resolved = resolveSkillCategory(stored)
  if (resolved.parentLabel === PARENT_FITNESS_LABEL) {
    return {
      parentLabel: PARENT_FITNESS_LABEL,
      subLabel: resolved.subLabel ?? CATEGORY_SONOTA,
    }
  }
  return {
    parentLabel: resolved.parentLabel,
    subLabel: "",
  }
}

/** 一覧フィルタ: parentFilter / subFilter は "all" またはラベル */
export function isSkillCategoryPickerComplete(parentLabel: string, subLabel: string): boolean {
  const parent = parentLabel.trim()
  if (!parent) {
    return false
  }
  if (parent === PARENT_FITNESS_LABEL) {
    return subLabel.trim().length > 0
  }
  return isParentCategoryLabel(parent)
}

export function matchesSkillCategoryFilter(
  itemCategory: string,
  parentFilter: string,
  subFilter: string,
): boolean {
  if (parentFilter === "all") {
    return true
  }

  const resolved = resolveSkillCategory(itemCategory)

  if (resolved.parentLabel !== parentFilter) {
    return false
  }

  if (parentFilter !== PARENT_FITNESS_LABEL) {
    return resolved.storedValue === parentFilter
  }

  if (subFilter === "all") {
    return true
  }

  if (resolved.isUnknownFallback) {
    return subFilter === CATEGORY_SONOTA
  }

  return resolved.subLabel === subFilter
}
