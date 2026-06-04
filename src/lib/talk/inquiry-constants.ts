/** GritVib 公開フォーム (`/legal/contact`) の固定値。 */
export const GRITVIB_INQUIRY_CATEGORY = "ご質問"
/** 件名未入力時の識別用（レガシー行の `source` 導入前データ）。新規は利用者入力の件名を保存。 */
export const GRITVIB_INQUIRY_SUBJECT_LEGACY = "GritVib お問い合わせ"
export const GRITVIB_INQUIRY_SUBJECT_MAX_LENGTH = 40
export const GRITVIB_INQUIRY_SOURCE = "gritvib"

export const GRITVIB_INQUIRY_STATUSES = ["pending", "investigating", "resolved"] as const
export type GritvibInquiryStatus = (typeof GRITVIB_INQUIRY_STATUSES)[number]

export function describeGritvibInquiryStatus(status: string): string {
  switch (status) {
    case "pending":
      return "未対応"
    case "investigating":
      return "調査中"
    case "resolved":
      return "対応済み"
    default:
      return status
  }
}
