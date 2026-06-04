/**
 * 一般ユーザー向け画面用のクライアントログ。
 * 本番では no-op。開発時もタグのみ（PII・レスポンス本体は出さない）。
 */
export function safeClientLogError(tag: string): void {
  if (process.env.NODE_ENV !== "development") {
    return
  }
  console.error(tag)
}

export function safeClientLogWarn(tag: string): void {
  if (process.env.NODE_ENV !== "development") {
    return
  }
  console.warn(tag)
}
