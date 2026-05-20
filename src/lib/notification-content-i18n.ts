import type { Locale } from "@/lib/i18n/locales"

/**
 * アプリ内通知の `title` / `content` を表示時に英訳するための辞書。
 *
 * 設計方針:
 * - DB の値（日本語）は一切変更しない。表示直前にこの関数を通すだけ。
 * - `locale !== "en"` の場合は入力をそのまま返す（既存ユーザー = 全員日本人 → 完全に従来挙動）。
 * - 完全一致しないパターン（管理者が自由入力した announcement 本文など）も入力をそのまま返す。
 * - パラメータ付きパターンは正規表現でキャプチャした文字列をテンプレに差し込む。
 * - `extractRejectionReasonFromContent` のような DB 値を直接パースする内部ロジックには
 *   影響しない（あくまで「画面に出る直前」だけで翻訳）。
 */

type ExactPair = {
  ja: string
  en: string
}

type Pattern = {
  ja: RegExp
  toEn: (captures: RegExpMatchArray) => string
}

const TITLE_EXACT_MAP: readonly ExactPair[] = [
  { ja: "新しい購入", en: "New purchase" },
  { ja: "新しい相談メッセージ", en: "New inquiry message" },
  { ja: "異議申し立て承認", en: "Dispute approved" },
  { ja: "異議申し立て棄却", en: "Dispute rejected" },
  // skills/[id]/page.tsx の consultation_request 通知で skill.title が空の場合のフォールバック。
  { ja: "事前オファー", en: "Pre-offer" },
]

const CONTENT_EXACT_MAP: readonly ExactPair[] = [
  {
    ja: "あなたのスキルに新しい購入がありました。チャットを確認してください。",
    en: "You received a new purchase for your skill. Please open the chat.",
  },
  {
    ja: "取引の相手から評価が届いています。",
    en: "You received a rating from your trading partner.",
  },
  {
    ja: "相談チャットに新しいメッセージが届きました。",
    en: "You received a new message in the inquiry chat.",
  },
  // 取引チャット（chat.notifications.newMessage）: chat/[transaction_id]/page.tsx で
  // メッセージ送信時に DB に書かれる。
  {
    ja: "新しいメッセージが届いています。",
    en: "You have a new message.",
  },
  // 取引完了申請（chat.notifications.applyForApproval）: 同上、完了申請時。
  {
    ja: "取引の完了申請が届いています。承認をお願いします。",
    en: "A completion request has been received. Please review and approve.",
  },
  {
    ja: "取引が買主により承認され、完了しました。",
    en: "The transaction was approved by the buyer and has been completed.",
  },
  {
    ja: "取引が完了しました。講師への支払いが確定しました。",
    en: "The transaction has been completed. Payment to the instructor has been finalized.",
  },
  {
    ja: "取引が完了しました（承認期限の経過により自動完了となりました）。",
    en: "The transaction has been completed (auto-completed because the approval period elapsed).",
  },
  {
    ja: "取引が完了しました（承認期限の経過により自動完了となりました）。講師への支払いが確定しました。",
    en: "The transaction has been completed (auto-completed because the approval period elapsed). Payment to the instructor has been finalized.",
  },
  {
    ja: "取引に異議申し立てがありました。運営の確認をお待ちください。",
    en: "A dispute has been filed for this transaction. Please wait for our team's review.",
  },
  {
    ja: "異議申し立てを送信しました。運営の確認をお待ちください。",
    en: "Your dispute has been submitted. Please wait for our team's review.",
  },
  {
    ja: "購入者より不足の連絡があり、異議申し立てが承認されました。現在取引が再開されていますので、不足分の対応をお願いします",
    en: "The buyer reported a shortfall and the dispute was approved. The transaction has resumed; please address the remaining items.",
  },
  {
    ja: "異議申し立てが認められました。取引を再開しますので、出品者と交渉を続けてください",
    en: "The dispute was approved. The transaction has resumed; please continue your discussion with the instructor.",
  },
  {
    ja: "異議申し立ての棄却により、取引が完了しました。",
    en: "The dispute was rejected and the transaction has been completed.",
  },
  {
    ja: "事前オファーの申し込みが届いています。受講リクエストをご確認ください。",
    en: "You received a new pre-offer request. Please check the requests panel.",
  },
  {
    ja: "事前オファーの申し込みが承認されました。購入手続きを進められます。",
    en: "Your pre-offer request was accepted. You can now proceed to purchase.",
  },
  {
    ja: "事前オファーが見送られました。",
    en: "Your pre-offer request was declined.",
  },
]

const CONTENT_PATTERN_MAP: readonly Pattern[] = [
  {
    // 事前オファー見送り（理由付き）
    ja: /^事前オファーが見送られました。理由:\s*([\s\S]+)$/,
    toEn: (m) => `Your pre-offer request was declined. Reason: ${(m[1] ?? "").trim()}`,
  },
  {
    // 商品の公開／非公開切替
    ja: /^運営対応:\s*あなたの商品「([\s\S]+?)」を(公開|非公開)に変更しました。理由:\s*([\s\S]+)$/,
    toEn: (m) => {
      const action = m[2] === "公開" ? "published" : "unpublished"
      return `Moderation: Your listing "${m[1] ?? ""}" has been ${action}. Reason: ${(m[3] ?? "").trim()}`
    },
  },
  {
    // 商品削除
    ja: /^運営対応:\s*商品「([\s\S]+?)」を削除しました。理由:\s*([\s\S]+)$/,
    toEn: (m) =>
      `Moderation: Listing "${m[1] ?? ""}" has been removed. Reason: ${(m[2] ?? "").trim()}`,
  },
  {
    // ユーザー BAN
    ja: /^運営対応:\s*(.+?)をBANしました。理由:\s*([\s\S]+)$/,
    toEn: (m) =>
      `Moderation: ${m[1] ?? ""} has been banned. Reason: ${(m[2] ?? "").trim()}`,
  },
  {
    // ユーザー状態変更
    ja: /^運営対応:\s*ユーザー状態を「([\s\S]+?)」へ変更しました。理由:\s*([\s\S]+)$/,
    toEn: (m) =>
      `Moderation: User status changed to "${m[1] ?? ""}". Reason: ${(m[2] ?? "").trim()}`,
  },
  {
    // 異議棄却＋取引完了
    ja: /^運営対応:\s*異議申し立てを棄却し、取引を完了扱いにしました。理由:\s*([\s\S]+)$/,
    toEn: (m) =>
      `Moderation: The dispute has been rejected and the transaction marked as completed. Reason: ${(m[1] ?? "").trim()}`,
  },
]

/**
 * 通知の `title` を locale に応じて英訳する。
 * - `locale === "ja"` のときは入力をそのまま返す（既存ユーザーの完全保護）。
 * - 完全一致するキーが無い場合も入力をそのまま返す（admin 入力タイトル等は触らない）。
 */
export function translateNotificationTitle(
  input: string | null | undefined,
  locale: Locale,
): string | null {
  if (input == null) {
    return null
  }
  if (locale !== "en") {
    return input
  }
  const trimmed = input.trim()
  if (!trimmed) {
    return input
  }
  const found = TITLE_EXACT_MAP.find((entry) => entry.ja === trimmed)
  return found ? found.en : input
}

/**
 * 通知の `content` を locale に応じて英訳する。
 * - `locale === "ja"` のときは入力をそのまま返す。
 * - 完全一致 → パラメータ付きパターンの順で評価し、いずれもヒットしなければ入力をそのまま返す。
 */
export function translateNotificationContent(
  input: string | null | undefined,
  locale: Locale,
): string | null {
  if (input == null) {
    return null
  }
  if (locale !== "en") {
    return input
  }
  const trimmed = input.trim()
  if (!trimmed) {
    return input
  }
  const exact = CONTENT_EXACT_MAP.find((entry) => entry.ja === trimmed)
  if (exact) {
    return exact.en
  }
  for (const pattern of CONTENT_PATTERN_MAP) {
    const m = trimmed.match(pattern.ja)
    if (m) {
      return pattern.toEn(m)
    }
  }
  return input
}
