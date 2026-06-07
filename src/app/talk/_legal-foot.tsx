"use client"

import Link from "next/link"
import { useTranslations } from "@/lib/i18n/useI18n"

/**
 * GritVib (人間チャットサービス) 共通の極小フッター。利用規約・プライバシーポリシー・特定商取引法に基づく表記
 * へのリンクのみを、ページ最下部に控えめに置く。
 */
export function LegalFoot({ className }: { className?: string }) {
  const tFooter = useTranslations("footer")
  const tLegal = useTranslations("legal")

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
            {tFooter("terms")}
          </Link>
        </li>
        <li>
          <Link
            href="/legal/privacy-policy"
            className="hover:text-zinc-900 hover:underline"
          >
            {tFooter("privacy")}
          </Link>
        </li>
        <li>
          <Link
            href="/legal/specified-commercial-transactions"
            className="hover:text-zinc-900 hover:underline"
          >
            {tFooter("commercial")}
          </Link>
        </li>
        <li>
          <Link
            href="/legal/contact"
            className="hover:text-zinc-900 hover:underline"
          >
            {tLegal("contactLinkLabel")}
          </Link>
        </li>
      </ul>
    </footer>
  )
}
