import "server-only"

import { getAppBaseUrl, getSiteUrl } from "@/lib/site-seo"

/**
 * Route Handler 用の CSRF 軽量ガード。
 *
 * - 同一オリジンからの POST のみ受け付ける目的。
 * - 判定優先順位:
 *   1. リクエスト URL (`new URL(request.url).origin`) と Origin ヘッダーが一致 → 許可
 *   2. `getSiteUrl()` / `getAppBaseUrl()` のいずれかと一致 → 許可（プロキシ経由などの保険）
 *   3. それ以外 → 拒否
 * - Origin ヘッダーが存在しない場合は拒否する（モダンブラウザは fetch/XHR の POST で
 *   通常 Origin を送るため、無い場合はブラウザ外のクライアントとみなす）。
 *
 * `getSiteUrl()` のみと比較していた旧実装では、ローカル開発で `http://localhost:3000`
 * からの POST が常に 403 になっていたため、こちらを優先的に使うこと。
 */
export function isAllowedSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim()
  if (!origin) {
    return false
  }

  try {
    const requestOrigin = new URL(request.url).origin
    if (origin === requestOrigin) {
      return true
    }
  } catch {
    /* request.url が不正な形式の場合のフォールバック */
  }

  const allowed = new Set<string>()
  try {
    allowed.add(new URL(getSiteUrl()).origin)
  } catch {
    /* noop */
  }
  try {
    allowed.add(new URL(getAppBaseUrl()).origin)
  } catch {
    /* noop */
  }

  return allowed.has(origin)
}
