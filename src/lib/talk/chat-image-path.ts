/** Storage object 名の正規化（先頭スラッシュ除去・trim）。 */
export function normalizeGritvibChatImagePath(path: string): string {
  return path.trim().replace(/^\/+/, "")
}
