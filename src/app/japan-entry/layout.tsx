import { JapanEntryFooter, JapanEntryHeader } from "@/japan-entry/_chrome"

/**
 * /japan-entry 配下のルートに、ロゴだけ共通の独自ヘッダー・フッターを適用するレイアウト。
 * 既存サイトヘッダー/フッターは ConditionalSiteHeader / ConditionalFooter 側で非表示にしている。
 */
export default function JapanEntryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <JapanEntryHeader />
      <main className="flex-1">{children}</main>
      <JapanEntryFooter />
    </div>
  )
}
