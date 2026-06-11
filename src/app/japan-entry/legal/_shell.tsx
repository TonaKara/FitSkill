"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"

type JapanEntryLegalShellProps = {
  title: string
  children: ReactNode
}

/** /japan-entry/legal/* 用の最小レイアウト（Japan Entry ヘッダー・フッターは親 layout が提供）。 */
export function JapanEntryLegalShell({ title, children }: JapanEntryLegalShellProps) {
  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/japan-entry"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary-readable"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to Japan Entry
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>

        <div className="mt-8">{children}</div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/japan-entry"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary-readable"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to Japan Entry
          </Link>
        </div>
      </div>
    </div>
  )
}
