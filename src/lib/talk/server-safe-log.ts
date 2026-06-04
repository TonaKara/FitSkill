import "server-only"

/** Server Action 用ログ（サーバー・ブラウザともにコンソールへは出さない）。 */
export function logTalkServerError(_tag: string, _err?: unknown): void {
  /* no-op */
}
