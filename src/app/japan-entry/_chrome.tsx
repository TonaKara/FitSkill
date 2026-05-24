import Link from "next/link"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { STRIPE_LINKS } from "@/japan-entry/_stripe-links"

/**
 * /japan-entry 配下で共有する独自ヘッダー。
 * - 既存サイトヘッダーは middleware / shouldShowSiteHeader で非表示。
 * - ロゴだけ既存と同一で、サブラベル "Japan Entry Support" を併記。
 */
export function JapanEntryHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 w-full items-center justify-between px-4 md:px-8">
        <Link
          href="/japan-entry"
          className="flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Japan Entry Support by GritVib"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] sm:h-10 sm:w-10">
            <BrandMarkSvg className="block h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
          </div>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight sm:text-lg">
              <span className="text-[#e64a19]">Grit</span>
              <span className="text-zinc-950 dark:text-white">Vib</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
              Japan Entry Support
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/japan-entry#pricing"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary-readable sm:inline"
          >
            Pricing
          </Link>
          <a
            href={STRIPE_LINKS.customerPortal}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-primary-readable md:inline"
          >
            Manage Subscription
          </a>
          {/* ===== TEMP: STRIPE PAYMENT TEST BUTTON — START =====
              本番デプロイ後の決済動作確認用の暫定ボタン。
              テスト完了後は、この `===== TEMP ... START =====` から
              `===== TEMP ... END =====` までのブロックをまるごと削除すれば完全に消せる。 */}
          <a
            href="https://buy.stripe.com/aFa5kC2IWfKzgjodLN9IQ07"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-md border border-dashed border-yellow-500/70 bg-yellow-500/10 px-3 text-sm font-semibold text-yellow-700 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400 sm:h-10 sm:px-4"
          >
            テスト
          </a>
          {/* ===== TEMP: STRIPE PAYMENT TEST BUTTON — END ===== */}
          <Link
            href="/japan-entry/contact"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-muted sm:h-10 sm:px-4"
          >
            Talk to us
          </Link>
        </nav>
      </div>
    </header>
  )
}

/**
 * /japan-entry 配下で共有する独自ミニフッター。
 */
export function JapanEntryFooter() {
  return (
    <footer className="bg-background">
      <div className="flex w-full flex-col gap-3 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
        <p>© {new Date().getFullYear()} GritVib — Japan Entry Support.</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/" className="transition-colors hover:text-primary-readable">
            GritVib home
          </Link>
          <Link href="/legal/terms" className="transition-colors hover:text-primary-readable">
            Terms
          </Link>
          <Link href="/legal/privacy-policy" className="transition-colors hover:text-primary-readable">
            Privacy
          </Link>
          <Link href="/japan-entry/contact" className="transition-colors hover:text-primary-readable">
            Contact
          </Link>
          <a
            href={STRIPE_LINKS.customerPortal}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary-readable"
          >
            Manage Subscription
          </a>
        </nav>
      </div>
    </footer>
  )
}
