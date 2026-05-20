/** 管理画面「お知らせ」で共通利用 */

export const ANNOUNCEMENT_REASON_OPTIONS = [
  "利用規約違反",
  "不適切な画像",
  "重要なお知らせ",
  "運営メンテナンス",
  "運営判断",
] as const

export type AnnouncementFormValues = {
  title: string
  reason: string
  content: string
}
