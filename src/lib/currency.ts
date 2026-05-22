/**
 * GritVib における通貨定義の唯一の真実 (single source of truth)。
 *
 * # 保存方式（設計判断 C: price 再定義方式）
 * - DB の `skills.price` / `transactions.price` は **その行の `currency` の最小単位** で格納する。
 *   - `currency = 'JPY'` の場合: `price = 1000` → ¥1,000（JPY は小数なし、1 unit = 1 yen）
 *   - `currency = 'USD'` の場合: `price = 1000` → $10.00（USD は cents、100 unit = $1.00）
 * - 既存データはすべて `currency = 'JPY'` で backfill されるため、整数 yen として
 *   読み取り続けて完全互換。
 *
 * # 厳禁
 * - 通貨の「表示用換算（USD ⇄ JPY）」をここで行わない。FX は Stripe 任せ。
 * - "stripe にそのまま渡せる integer" の生成だけここで保証する。
 */

/** サポートする通貨コード（ISO 4217）。新規通貨を追加する場合はここに追記し、CHECK 制約も更新。 */
export const SUPPORTED_CURRENCIES = ["JPY", "USD"] as const

export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

/**
 * DB DEFAULT 値。既存データの暗黙の通貨を維持。
 * 既存ユーザー（日本人のみ）にとって変更前と完全互換となるよう "JPY" 固定とする。
 */
export const DEFAULT_CURRENCY: Currency = "JPY"

/** type ガード */
export function isSupportedCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/**
 * 不明値・null・未設定はすべて DEFAULT_CURRENCY にフォールバック。
 * 既存 JPY データ・古いコード経路で `currency` が未指定でも安全に動かすための保険。
 */
export function normalizeCurrency(value: unknown): Currency {
  return isSupportedCurrency(value) ? value : DEFAULT_CURRENCY
}

/**
 * 各通貨の小数桁数（minor unit の指数）。
 * - JPY: 0 桁 → 1 unit = 1 yen
 * - USD: 2 桁 → 100 unit = $1.00
 *
 * Stripe API の最小単位とも完全一致する。
 */
const CURRENCY_DECIMAL_PLACES: Record<Currency, number> = {
  JPY: 0,
  USD: 2,
}

export function getCurrencyDecimalPlaces(currency: Currency): number {
  return CURRENCY_DECIMAL_PLACES[currency]
}

/**
 * 通貨記号。`Intl.NumberFormat` でも生成できるが、`narrowSymbol` の差が出ない処理用に
 * 明示的に固定しておく（"¥1,000" のように locale 影響を受けないシンプル表示用）。
 */
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  JPY: "¥",
  USD: "$",
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency]
}

/**
 * Stripe API に渡す currency 文字列。Stripe は小文字 ISO 4217 を要求する。
 */
export function toStripeCurrencyCode(currency: Currency): string {
  return currency.toLowerCase()
}

/**
 * 「DB に保存された最小単位 amount」を「ヒューマンリーダブルな major 単位」に変換。
 * 表示にしか使わないため数値で返す（formatting は formatCurrency 側で）。
 * - JPY: 1000 → 1000（unchanged, decimals=0）
 * - USD: 1000 → 10（cents → dollars）
 */
export function minorUnitsToMajor(amountMinor: number, currency: Currency): number {
  const decimals = getCurrencyDecimalPlaces(currency)
  if (decimals === 0) {
    return amountMinor
  }
  return amountMinor / 10 ** decimals
}

/**
 * 「major 単位（ユーザー入力など）」を「DB / Stripe 用の最小単位 integer」に変換。
 * - JPY: 1000 → 1000
 * - USD: 10 → 1000、10.5 → 1050、10.555 → 1056 (四捨五入)
 *
 * 浮動小数点の桁誤差を避けるため、文字列化して丸めるアプローチ。
 */
export function majorToMinorUnits(amountMajor: number, currency: Currency): number {
  if (!Number.isFinite(amountMajor)) {
    return 0
  }
  const decimals = getCurrencyDecimalPlaces(currency)
  if (decimals === 0) {
    return Math.max(0, Math.round(amountMajor))
  }
  // 1.005 のような場合に正しく 100.5 cents = 101 cents として丸めるため、いったん文字列経由で
  // 桁を上げてから整数 round する。
  return Math.max(0, Math.round(amountMajor * 10 ** decimals))
}

/**
 * Stripe Checkout の `line_items[].price_data.unit_amount` に渡す integer。
 * DB の price はすでに最小単位なので、そのまま返すだけ。エイリアスとして用意。
 */
export function toStripeUnitAmount(amountMinor: number): number {
  return Math.max(0, Math.trunc(amountMinor))
}

/**
 * locale-aware な通貨フォーマット。
 * - `htmlLang` は `ja` / `en-US` 等の BCP47。`localeToHtmlLang(locale)` を渡す想定。
 * - `Intl.NumberFormat` を使い、各 locale の慣習に従って表示する。
 *   例:
 *   - `formatCurrency(1000, "JPY", "ja")` → "￥1,000"
 *   - `formatCurrency(1000, "USD", "en-US")` → "$10.00"（1000 cents → 10.00 ドル換算済み）
 *
 * **重要**: 第 1 引数 `amountMinor` は **最小単位の integer**（DB の price がそのまま渡る前提）。
 *           Intl.NumberFormat には major 単位で渡す必要があるため内部で換算する。
 */
export function formatCurrency(
  amountMinor: number,
  currency: Currency,
  htmlLang: string,
): string {
  const major = minorUnitsToMajor(amountMinor, currency)
  return new Intl.NumberFormat(htmlLang, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(major)
}

/**
 * 既存の「￥1,000」のような独自表示文字列を返したい時用。
 * `Intl.NumberFormat` の locale 慣習に依らず、`<symbol><千区切り数値>` で組む。
 *
 * 後方互換性のために用意（既存 UI で "¥{price}" のような独自レイアウトを使っている箇所がある）。
 */
export function formatCurrencyPlain(amountMinor: number, currency: Currency): string {
  const major = minorUnitsToMajor(amountMinor, currency)
  const decimals = getCurrencyDecimalPlaces(currency)
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major)
  return `${getCurrencySymbol(currency)}${formatted}`
}
