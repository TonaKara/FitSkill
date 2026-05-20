import { ALLOWED_EXTERNAL_TOOLS_LIST } from "@/lib/allowed-external-tools"
import type { Locale } from "@/lib/i18n/locales"

type LocalizedBullets = {
  ja: readonly string[]
  en: readonly string[]
}

/** 取引最終確認（出品者向け） */
export const TRADE_LEGAL_BULLETS_SELLER: LocalizedBullets = {
  ja: [
    "18歳未満に対する対面指導は行いません。",
    "性的な文脈や不適切な投稿、詐欺行為は禁止です。",
    "外部ツールは {ALLOWED_EXTERNAL_TOOLS_LIST} のみ利用できます。",
    "本サービス外での直接的な金銭の要求は禁止です。",
    "取引完了後、チャット上の画像・動画は自動的に削除されます。",
    "出品内容が第三者の権利を侵害していないことを保証します。",
    "居住国での納税義務は自身の責任において履行します。",
  ],
  en: [
    "In-person instruction for users under 18 is prohibited.",
    "Sexual content, inappropriate posts, and fraudulent acts are strictly prohibited.",
    "Only {ALLOWED_EXTERNAL_TOOLS_LIST} may be used as external tools.",
    "Direct payment requests outside of the Service are strictly prohibited.",
    "Images/videos in chat will be automatically deleted after transaction completion.",
    "You guarantee that your content does not infringe on third-party rights.",
    "You are responsible for tax obligations in your country of residence.",
  ],
}

/** 取引最終確認（購入者向け） */
export const TRADE_LEGAL_BULLETS_BUYER: LocalizedBullets = {
  ja: [
    "18歳未満の方は対面指導を受けることができません",
    "返金・キャンセルは原則行えません。",
    "外部サービスでの支払い要求には応じないでください（詐欺の可能性があります）。",
    "外部ツール（{ALLOWED_EXTERNAL_TOOLS_LIST} 以外）の利用は自己責任となります。",
    "対面指導におけるトラブルは当事者間で解決してください。",
    "講師へのハラスメントや差別的言動はアカウント停止の対象となります。",
    "セッションの録画やコンテンツの無断転載を禁止します。",
  ],
  en: [
    "Users under 18 cannot receive in-person instruction.",
    "Refunds and cancellations are generally not accepted.",
    "Do not respond to payment requests outside of GritVib (Risk of fraud).",
    "Use of external tools (other than {ALLOWED_EXTERNAL_TOOLS_LIST}) is at your own risk.",
    "Any issues regarding in-person sessions must be resolved between the parties.",
    "Harassment or discriminatory behavior is grounds for account suspension.",
    "Recording sessions or unauthorized redistribution of content is strictly prohibited.",
  ],
}

/** ロケールに応じた注意事項配列を取得し、`{ALLOWED_EXTERNAL_TOOLS_LIST}` プレースホルダを差し替える */
export function resolveTradeLegalBullets(
  source: LocalizedBullets,
  locale: Locale,
): readonly string[] {
  const list = locale === "en" ? source.en : source.ja
  return list.map((line) => line.replace("{ALLOWED_EXTERNAL_TOOLS_LIST}", ALLOWED_EXTERNAL_TOOLS_LIST))
}
