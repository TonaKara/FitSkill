/** サイト共通ヘッダーを表示しないルート（専用ヘッダーまたは管理画面レイアウト） */
export function shouldShowSiteHeader(pathname: string): boolean {
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return false
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return false
  }
  /** /japan-entry は専用の英語ランディングヘッダーを使用するため、共通ヘッダーは表示しない */
  if (pathname === "/japan-entry" || pathname.startsWith("/japan-entry/")) {
    return false
  }
  return true
}
