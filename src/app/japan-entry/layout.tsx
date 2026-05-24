import { JapanEntryFooter, JapanEntryHeader } from "@/japan-entry/_chrome"
import { JapanEntryScrollReset } from "@/japan-entry/_scroll-reset"

/**
 * /japan-entry 配下のルートに、ロゴだけ共通の独自ヘッダー・フッターを適用するレイアウト。
 * 既存サイトヘッダー/フッターは ConditionalSiteHeader / ConditionalFooter 側で非表示にしている。
 *
 * `JapanEntryScrollReset` は client コンポーネントで、初回マウント / パス変更時に
 * スクロール位置を最上部へリセットする（ハッシュアンカーがある場合は尊重）。
 */
export default function JapanEntryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <JapanEntryScrollReset />
      <JapanEntryHeader />
      <main className="flex-1">{children}</main>
      <JapanEntryFooter />
    </div>
  )
}
