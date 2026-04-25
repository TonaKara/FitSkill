/** 出品フォーム・プロフィール等で共有するカテゴリ一覧（50音順 + その他） */
export const CATEGORY_SONOTA = "その他"

export const SKILL_CATEGORY_OPTIONS = [
  ...[
    "格闘技",
    "筋トレ",
    "サッカー",
    "ストレッチ",
    "ダイエット",
    "ダンス",
    "バスケ",
    "バドミントン",
    "ピラティス",
    "ヨガ",
    "ランニング",
  ].sort((a, b) => a.localeCompare(b, "ja")),
  CATEGORY_SONOTA,
]
