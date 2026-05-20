import type { Locale } from "@/lib/i18n/locales"

/**
 * 一般ユーザー向けトースト／通知文言の **表示時 JA→EN 翻訳マップ**。
 *
 * 設計方針（最も安全な実装のため）:
 * - `notifications.ts` / `stripe-payout-error-notice.ts` / `utils.ts` / Server Actions
 *   など、ヘルパや Server Action 側の戻り値は **一切変更しない**。
 * - これらが返す既知の JA リテラルを、`NotificationToast` 表示直前にこのモジュールで
 *   差し替える。
 * - 対応マップに無い文言（管理者向け詳細付きエラー、admin 入力テキスト、未知のサーバー
 *   エラー文字列など）は **そのまま JA のまま** 表示される。
 * - locale === "ja" のときは即座に入力値を返し、JA ユーザーの体験は完全に従来どおり。
 * - 管理者は全員 JA 設定のため、`（詳細: code: ... / message: ...）` 形式の admin 向け
 *   ラッパは意図的に翻訳しない。
 */

type ExactPair = { ja: string; en: string }
type Pattern = { ja: RegExp; toEn: (captures: RegExpMatchArray) => string }

/** 完全一致で差し替える文言（notifications.ts / Server Action / 各種ヘルパ） */
const EXACT_MAP: readonly ExactPair[] = [
  // notifications.ts
  {
    ja: "システムエラーが発生しました。時間を置いてお試しください。",
    en: "A system error occurred. Please try again later.",
  },
  {
    ja: "ログインに失敗しました。メアドかパスワードを確認してください。",
    en: "Sign-in failed. Please check your email and password.",
  },
  {
    ja: "このメールアドレスは既に登録されています。",
    en: "This email address is already registered.",
  },
  {
    ja: "同じ内容のデータが既に登録されています。",
    en: "Data with the same content has already been registered.",
  },
  {
    ja: "運営による非公開のため、ご自身で公開に戻すことはできません。",
    en: "This item was unpublished by the operator and cannot be re-published by yourself.",
  },

  // stripe-payout-error-notice.ts
  {
    ja: "ログイン状態を確認できませんでした。ページを再読み込みしてから、もう一度お試しください。",
    en: "We could not verify your sign-in. Please reload the page and try again.",
  },
  {
    ja: "振込先の登録を続行するための準備が整っていません。時間を置いて再度お試しください。解決しない場合はお問い合わせください。",
    en: "We are not ready to continue the payout account setup. Please try again later. If the issue persists, please contact us.",
  },
  {
    ja: "Stripe 連携情報の保存に失敗しました。時間を置いて再度お試しください。",
    en: "Failed to save Stripe connection information. Please try again later.",
  },
  {
    ja: "振込先の情報を保存できませんでした。時間を置いて再度お試しください。解決しない場合はお問い合わせください。",
    en: "Could not save your payout information. Please try again later. If the issue persists, please contact us.",
  },
  {
    ja: "Stripe 連携情報の保存設定が不足しています。時間を置いて再度お試しください。",
    en: "Stripe connection storage settings are incomplete. Please try again later.",
  },

  // actions/checkout.ts (購入フロー)
  {
    ja: "購入条件の確認に失敗しました。時間をおいて再度お試しください。",
    en: "Failed to verify purchase conditions. Please try again later.",
  },
  {
    ja: "相談リクエストが承認待ちです。承認後に購入できます。",
    en: "Your pre-offer request is pending approval. You can purchase after approval.",
  },
  {
    ja: "相談リクエストが拒否されています。再度申請して承認を待ってください。",
    en: "Your pre-offer request was declined. Please re-apply and wait for approval.",
  },
  {
    ja: "このスキルは事前相談の承認後に購入できます。",
    en: "This skill can be purchased only after a pre-offer is approved.",
  },
  {
    ja: "講師の振込先（Stripe）の登録が完了していないため、オンライン決済できません。しばらくしてから再度お試しください。",
    en: "Online payment is unavailable because the instructor has not completed their Stripe payout registration. Please try again later.",
  },
  {
    ja: "決済セッション作成中に不明なエラーが発生しました。",
    en: "An unknown error occurred while creating the payment session.",
  },
  {
    ja: "この決済セッションを解放する権限がありません。",
    en: "You don't have permission to release this payment session.",
  },
  {
    ja: "仮押さえの解放に失敗しました。",
    en: "Failed to release the hold.",
  },
  {
    ja: "決済完了の確認が取れませんでした。",
    en: "Could not confirm payment completion.",
  },
  {
    ja: "決済メタデータが不足しています。",
    en: "Payment metadata is missing.",
  },
  {
    ja: "この決済を確定する権限がありません。",
    en: "You don't have permission to confirm this payment.",
  },
  {
    ja: "重複した決済が検出されたため、自動返金されます。取引チャットをご確認ください。",
    en: "A duplicate payment was detected and will be automatically refunded. Please check the transaction chat.",
  },
  {
    ja: "申し込み枠が満杯のため、決済は自動返金されます。時間をおいて再度お試しください。",
    en: "The application slots are full. The payment will be automatically refunded. Please try again later.",
  },
  {
    ja: "決済反映中に不明なエラーが発生しました。",
    en: "An unknown error occurred while applying the payment.",
  },

  // actions/transaction.ts
  {
    ja: "ログインが必要です。",
    en: "Sign-in is required.",
  },
  {
    ja: "取引の取得に失敗しました。",
    en: "Failed to load the transaction.",
  },
  {
    ja: "取引が見つかりません。",
    en: "Transaction not found.",
  },
  {
    ja: "条件不一致（すでに完了済み、または権限なし）",
    en: "Conditions do not match (already completed, or no permission).",
  },
  {
    ja: "取引の更新に失敗しました。",
    en: "Failed to update the transaction.",
  },
  {
    ja: "取引の更新に失敗しました。画面を更新して再度お試しください。",
    en: "Failed to update the transaction. Please refresh the page and try again.",
  },

  // actions/payout.ts
  {
    ja: "この取引を完了できるのは購入者のみです。",
    en: "Only the buyer can complete this transaction.",
  },
  {
    ja: "取引は完了承認待ち状態ではありません。",
    en: "The transaction is not in the approval-pending state.",
  },
  {
    ja: "この取引は異議申立て中ではありません。",
    en: "This transaction is not in dispute.",
  },
  // 異議申立て中の「管理画面の…」文言は管理者向けのため意図的に未翻訳。

  // actions/stripe.ts
  {
    ja: "オンボーディング内容への同意が必要です。",
    en: "You must agree to the onboarding terms.",
  },
  {
    ja: "Stripe Connect の口座が見つかりません。",
    en: "Stripe Connect account not found.",
  },

  // store-listings.ts
  {
    ja: "出品商品の取得に失敗しました。",
    en: "Failed to load listed items.",
  },
]

/** 動的部分を含むメッセージ（utils.ts の `getUnknownErrorMessage` など）の正規表現マッピング */
const PATTERN_MAP: readonly Pattern[] = [
  {
    // utils.ts: `予期せぬエラーが発生しました（${digest.slice(0, 12)}）`
    ja: /^予期せぬエラーが発生しました（([^）]+)）$/,
    toEn: (m) => `An unexpected error occurred (${m[1] ?? ""}).`,
  },
]

/**
 * トースト／通知文言を表示時に翻訳する。
 *
 * - locale === "ja" の場合、または入力が空の場合は **入力をそのまま返す**。
 * - EXACT_MAP に該当しなければ PATTERN_MAP を試す。
 * - 全てに該当しない場合は **JA のまま返す**（DB 由来のテキストや管理者向け詳細など、
 *   翻訳しない方が安全なケースを尊重する）。
 *
 * 本関数は副作用を持たず、DB やネットワークにも触れない純粋関数。
 */
export function translateToastMessage(
  input: string | null | undefined,
  locale: Locale,
): string {
  if (input == null) {
    return ""
  }
  if (locale !== "en") {
    return input
  }
  const trimmed = input.trim()
  if (!trimmed) {
    return input
  }
  const exact = EXACT_MAP.find((entry) => entry.ja === trimmed)
  if (exact) {
    return exact.en
  }
  for (const pattern of PATTERN_MAP) {
    const m = trimmed.match(pattern.ja)
    if (m) {
      return pattern.toEn(m)
    }
  }
  return input
}
