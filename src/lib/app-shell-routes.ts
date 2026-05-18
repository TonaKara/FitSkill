/** PC 左サイドバー＋メイン2カラムを使うルート */
export function isAppShellRoute(pathname: string): boolean {
  if (pathname === "/") {
    return true
  }
  if (pathname.startsWith("/account/")) {
    return true
  }
  if (pathname === "/create-skill" || pathname.startsWith("/create-skill/")) {
    return true
  }
  if (pathname === "/discover" || pathname.startsWith("/discover/")) {
    return true
  }
  return false
}
