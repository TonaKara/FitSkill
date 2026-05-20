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

/* -------------------------------------------------------------------------- */
/* i18n 対応：表示ラベル（日本語 / 英語）を持つカテゴリ定義                   */
/* -------------------------------------------------------------------------- */

/**
 * 多言語表示用のカテゴリ項目。
 * - `storedValue` は DB（`skills.category` 等）に保存される値で必ず日本語のまま。
 * - `labelJa` / `labelEn` は表示用ラベル。`labelEn` 未定義の場合は `labelJa` をフォールバック。
 * - `parentId` を持つ場合は子カテゴリ（フィットネス配下のサブカテゴリ等）。
 *
 * 新規言語を追加する場合は labelXx を増やす方針。
 * 既存の `PARENT_CATEGORY_LABELS` / `FITNESS_SUB_CATEGORY_LABELS` は変更しない（後方互換）。
 */
export type SkillCategoryItem = {
  id: string
  storedValue: string
  labelJa: string
  labelEn: string
  parentId?: string
}

export const SKILL_CATEGORY_PARENT_ITEMS: readonly SkillCategoryItem[] = [
  { id: "fitness",  storedValue: PARENT_FITNESS_LABEL, labelJa: "フィットネス", labelEn: "Fitness" },
  { id: "cooking",  storedValue: "料理",                labelJa: "料理",          labelEn: "Cooking" },
  { id: "game",     storedValue: "ゲーム",              labelJa: "ゲーム",        labelEn: "Gaming" },
  { id: "study",    storedValue: "勉強",                labelJa: "勉強",          labelEn: "Study" },
  { id: "creation", storedValue: "創作",                labelJa: "創作",          labelEn: "Creation" },
  { id: "art",      storedValue: "芸術",                labelJa: "芸術",          labelEn: "Art" },
  { id: "other",    storedValue: CATEGORY_SONOTA,       labelJa: "その他",        labelEn: "Other" },
]

export const SKILL_CATEGORY_FITNESS_SUB_ITEMS: readonly SkillCategoryItem[] = [
  { id: "soccer",            storedValue: "サッカー",     labelJa: "サッカー",     labelEn: "Soccer",            parentId: "fitness" },
  { id: "stretch",           storedValue: "ストレッチ",   labelJa: "ストレッチ",   labelEn: "Stretching",        parentId: "fitness" },
  { id: "diet",              storedValue: "ダイエット",   labelJa: "ダイエット",   labelEn: "Diet",              parentId: "fitness" },
  { id: "dance",             storedValue: "ダンス",       labelJa: "ダンス",       labelEn: "Dance",             parentId: "fitness" },
  { id: "basketball",        storedValue: "バスケ",       labelJa: "バスケ",       labelEn: "Basketball",        parentId: "fitness" },
  { id: "badminton",         storedValue: "バドミントン", labelJa: "バドミントン", labelEn: "Badminton",         parentId: "fitness" },
  { id: "pilates",           storedValue: "ピラティス",   labelJa: "ピラティス",   labelEn: "Pilates",           parentId: "fitness" },
  { id: "yoga",              storedValue: "ヨガ",         labelJa: "ヨガ",         labelEn: "Yoga",              parentId: "fitness" },
  { id: "running",           storedValue: "ランニング",   labelJa: "ランニング",   labelEn: "Running",           parentId: "fitness" },
  { id: "martialArts",       storedValue: "格闘技",       labelJa: "格闘技",       labelEn: "Martial Arts",      parentId: "fitness" },
  { id: "strengthTraining",  storedValue: "筋トレ",       labelJa: "筋トレ",       labelEn: "Strength Training", parentId: "fitness" },
  { id: "fitnessOther",      storedValue: CATEGORY_SONOTA, labelJa: "その他",      labelEn: "Other",             parentId: "fitness" },
]

/** 全カテゴリ項目（親 + サブ） */
export const SKILL_CATEGORY_ITEMS: readonly SkillCategoryItem[] = [
  ...SKILL_CATEGORY_PARENT_ITEMS,
  ...SKILL_CATEGORY_FITNESS_SUB_ITEMS,
]

/** locale に応じたラベルを返す */
export function getCategoryLabel(
  item: Pick<SkillCategoryItem, "labelJa" | "labelEn">,
  locale: "ja" | "en",
): string {
  if (locale === "en" && item.labelEn) {
    return item.labelEn
  }
  return item.labelJa
}

const STORED_VALUE_TO_ITEM = new Map<string, SkillCategoryItem>(
  SKILL_CATEGORY_ITEMS.map((item) => [item.storedValue, item]),
)

/** DB 値（日本語）から多言語カテゴリ項目を引く */
export function findCategoryItemByStoredValue(storedValue: string | null | undefined): SkillCategoryItem | null {
  if (!storedValue) {
    return null
  }
  return STORED_VALUE_TO_ITEM.get(storedValue.trim()) ?? null
}

/**
 * DB 値（日本語）を locale に応じた表示文字列に変換する純粋関数。
 * 親>子の階層を保ったままローカライズしたい場合は `formatSkillCategoryDisplay` の代替として使う。
 */
export function localizeStoredCategory(
  storedValue: string | null | undefined,
  locale: "ja" | "en",
): string {
  const item = findCategoryItemByStoredValue(storedValue)
  if (item) {
    return getCategoryLabel(item, locale)
  }
  return (storedValue ?? "").trim() || (locale === "en" ? "Other" : CATEGORY_SONOTA)
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
