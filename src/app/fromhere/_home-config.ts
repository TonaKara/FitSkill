/**
 * ホーム画面の共通設定値（クライアント / サーバー両方から参照する）。
 *
 * - `_data.ts` には `server-only` / `next/headers` の依存があるため、ここから
 *   定数を import するとクライアントに `next/headers` が引き込まれてビルドエラーに
 *   なる。クライアントから参照する純粋な定数はこのファイルに分離して持つ。
 */

/** 4 セクションのホーム表示件数 */
export const HOME_SECTION_LIMITS = {
  today: 25,
  thisMonth: 10,
  lastMonth: 10,
  older: 10,
} as const

/**
 * 「ランキング表示」へ切り替える閾値。
 * - 本日 / 今月のみクライアントで判定するため、共通定数として持つ。
 * - products.length >= 閾値 なら順位 (#1, #2, ...) を出す。
 */
export const HOME_RANKING_THRESHOLD = {
  today: 25,
  thisMonth: 10,
} as const
