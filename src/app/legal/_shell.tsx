"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { LegalFoot } from "@/talk/_legal-foot"

/**
 * GritVib (人間チャットサービス) の世界観に揃えた、`/legal/*` ページ用の最小レイアウト。
 *
 * 設計要件:
 *   - 色は白と黒（補助グレー）だけ。枠線・装飾なし。
 *   - 共通ヘッダー / フッターを敢えて出さない (site-header-routes / ConditionalFooter で除外)。
 *   - 上部に「トップへ」リンク。
 *
 * 表示モード (`fit`):
 *   - false (既定): 縦長スクロール可能。利用規約等の長文向け。本文末尾にも「トップへ」を添え、
 *     最下部に LegalFoot を敷いてページ間遷移を担保する。
 *   - true:        1 画面に収める「フィット」モード。問い合わせフォームのように高さ可変領域
 *     (textarea) を持つページ用。スクロールを禁止し、本文エリアを `flex-1 min-h-0` で固定高さに
 *     する。本文末尾「トップへ」と LegalFoot は冗長になるため出さない。
 */
type LegalPageShellProps = {
  title: string
  topLinkLabel: string
  children: ReactNode
  fit?: boolean
}

export function LegalPageShell({
  title,
  topLinkLabel,
  children,
  fit = false,
}: LegalPageShellProps) {
  if (fit) {
    return (
      <div className="flex h-[100svh] flex-col overflow-hidden bg-white text-black">
        <div className="w-full flex-none px-4 pt-4 sm:px-6 sm:pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {topLinkLabel}
          </Link>
        </div>

        <main className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col overflow-hidden px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <h1 className="mb-3 flex-none text-xl font-semibold tracking-tight text-black sm:mb-5 sm:text-2xl md:text-3xl">
            {title}
          </h1>
          {/*
            子要素にも min-h-0 を継承させるため、ここでもう一段 flex コンテナを噛ませる。
            これにより `<form className="flex flex-1 min-h-0 flex-col ...">` の textarea が
            残り高さを安全に伸び縮みできる。
          */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-black">
      {/*
        上部の戻る導線。ヘッダーバーは敢えて組まず、ページ余白の左上に控えめに置く。
        テキストリンクのみで装飾はなし。
      */}
      <div className="w-full px-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {topLinkLabel}
        </Link>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-black sm:mb-10 sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {children}

        {/*
          長文を最後まで読んだ位置からも「トップへ」戻れるよう、本文末尾にも同じリンクを置く。
          ページ間の遷移リンクは下に控える LegalFoot が担う。
        */}
        <div className="mt-12 flex justify-center sm:mt-16">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-black"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {topLinkLabel}
          </Link>
        </div>
      </main>

      <LegalFoot />
    </div>
  )
}
