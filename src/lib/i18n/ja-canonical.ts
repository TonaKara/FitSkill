import { formatMessage, getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"

const JA_DICTIONARY = getDictionary("ja")

/**
 * **DB 保存用** の JA 正規形メッセージを取得する。
 *
 * 設計意図:
 * - `notifications.content` / `notifications.title` などの DB 列には、UI ロケールに関わらず
 *   **常に JA を保存** することがアプリ全体の方針。
 * - `useTranslations()` は呼び出し時の **送信者ロケール** で評価されるため、これを DB INSERT
 *   の値に使うと EN ロケール送信者だけ DB に EN が入って受信者と言語ミスマッチが起こる。
 * - そこで「DB に書く値」はこのヘルパで取り、「画面に出す値」は通常の `t()` / 表示時翻訳
 *   (`notification-content-i18n.ts`) を使う、という役割分担にする。
 *
 * 仕様:
 * - `ja.json` から `key` を引き、テンプレートの `{name}` などを `values` で置換した文字列を返す。
 * - 値が存在しない場合は `lookupMessage` の慣例どおりキーをそのまま返す（フェイルセーフ）。
 */
export function lookupJaMessage(
  key: string,
  values?: Record<string, string | number>,
): string {
  const template = lookupMessage(JA_DICTIONARY, key)
  return values ? formatMessage(template, values) : template
}
