import Link from "next/link"

/**
 * GritVib (人間チャットサービス) 共通の極小フッター。利用規約・プライバシーポリシー・特定商取引法に基づく表記
 * へのリンクのみを、ページ最下部に控えめに置く。
 *
 * 専用フッター/ヘッダーを敢えて設けない方針なので、各ページの最下部にこのコンポーネントを
 * そっと差し込むだけで構成を完結させる。
 */
export function LegalFoot({ className }: { className?: string }) {
  return (
    <footer
      className={[
        "w-full px-6 pb-6 pt-12 text-center text-[11px] leading-relaxed text-zinc-500",
        className ?? "",
      ].join(" ")}
    >
      <ul className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <li>
          <Link href="/legal/terms" className="hover:text-zinc-900 hover:underline">
            利用規約
          </Link>
        </li>
        <li>
          <Link
            href="/legal/privacy-policy"
            className="hover:text-zinc-900 hover:underline"
          >
            プライバシーポリシー
          </Link>
        </li>
        <li>
          <Link
            href="/legal/specified-commercial-transactions"
            className="hover:text-zinc-900 hover:underline"
          >
            特定商取引法に基づく表記
          </Link>
        </li>
        <li>
          <Link
            href="/legal/contact"
            className="hover:text-zinc-900 hover:underline"
          >
            お問い合わせ
          </Link>
        </li>
      </ul>
    </footer>
  )
}
