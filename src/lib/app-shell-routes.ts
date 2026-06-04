/** PC 左サイドバー＋メイン2カラムを使うルート */
export function isAppShellRoute(pathname: string): boolean {
  /**
   * 旧 GritVib トップは `/` から `/store` へ退避済み。サイドバー付き 2 カラム
   * レイアウトを担っていたのは旧トップの方なので、`/store` を有効ルートにする。
   * 新 `/` (GritVib 人間チャット) はサイドバー無しの極小レイアウトを使うため、ここから除外。
   */
  if (pathname === "/store") {
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
