/** サイト共通ヘッダーを表示しないルート（専用ヘッダーまたは管理画面レイアウト） */
export function shouldShowSiteHeader(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return false
  }
  /**
   * GritVib (人間チャットサービス) は極めてシンプルな構成を志向しており、共通ヘッダーは
   * 全画面で非表示にする。新トップ `/` も GritVib のランディングなので同様に隠す。
   * 旧 GritVib トップは `/store` 配下に退避済みで、そちらは引き続き共通ヘッダーを使う。
   */
  if (pathname === "/") {
    return false
  }
  if (pathname === "/talk" || pathname.startsWith("/talk/")) {
    return false
  }
  /** /landing-preview は独自フッター内包の試作 LP のため共通ヘッダーは出さない */
  if (pathname === "/landing-preview" || pathname.startsWith("/landing-preview/")) {
    return false
  }
  /**
   * /legal/* は GritVib に合わせた白黒の専用シェル (LegalPageShell) を採用しているため、
   * 共通ヘッダーは表示しない。上部に最小の「トップへ」リンクのみを置く。
   */
  if (pathname === "/legal" || pathname.startsWith("/legal/")) {
    return false
  }
  return true
}
