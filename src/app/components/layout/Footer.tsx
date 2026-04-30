import Link from "next/link"
import { SiX } from "@icons-pack/react-simple-icons"

const baseLinkClass =
  "text-sm text-zinc-300 transition-colors hover:text-white"

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black text-zinc-100">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-white">サービスについて</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/about" className={baseLinkClass}>
              GritVibについて
            </Link>
            <Link href="/legal/terms" className={baseLinkClass}>
              利用規約
            </Link>
            <Link href="/legal/privacy-policy" className={baseLinkClass}>
              プライバシーポリシー
            </Link>
            <Link href="/legal/specified-commercial-transactions" className={baseLinkClass}>
              特定商取引法に基づく表記
            </Link>
          </nav>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-white">ヘルプ＆ガイド</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/guide" className={baseLinkClass}>
              使い方ガイド
            </Link>
            <Link href="/contact" className={baseLinkClass}>
              お問い合わせ
            </Link>
          </nav>
        </section>

        <section className="flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">公式SNS</h2>
            <a
              href="https://x.com/gritvib_jp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GritVib公式X"
              className="text-zinc-200 transition-opacity hover:opacity-75"
            >
              <SiX className="w-6 h-6 fill-current" />
            </a>
          </div>
          <p className="text-sm text-zinc-400">© 2026 GritVib</p>
        </section>
      </div>
    </footer>
  )
}

