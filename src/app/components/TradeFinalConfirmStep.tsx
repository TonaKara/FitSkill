"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { LegalDocumentModal, type LegalDocumentKind } from "@/components/LegalDocumentModal"
import { Button } from "@/components/ui/button"
import { TRADE_LEGAL_BULLETS_BUYER, TRADE_LEGAL_BULLETS_SELLER } from "@/lib/trade-legal-notices"
import { cn } from "@/lib/utils"

export type TradeFinalConfirmVariant = "seller" | "buyer"

type TradeFinalConfirmStepProps = {
  variant: TradeFinalConfirmVariant
  actionLabel: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  /** モーダル表示時にチェックをリセットするためのキー */
  resetKey?: number
  className?: string
  showCancelButton?: boolean
  cancelLabel?: string
}

export function TradeFinalConfirmStep({
  variant,
  actionLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  resetKey = 0,
  className,
  showCancelButton = false,
  cancelLabel = "戻る",
}: TradeFinalConfirmStepProps) {
  const [agreed, setAgreed] = useState(false)
  const [legalModal, setLegalModal] = useState<LegalDocumentKind | null>(null)
  const bullets = variant === "seller" ? TRADE_LEGAL_BULLETS_SELLER : TRADE_LEGAL_BULLETS_BUYER
  const physicalSafetyNotice =
    variant === "buyer"
      ? "怪我、既往歴、妊娠中など、体調に不安がある方は必ず医師の指示に従い、自己責任で受講してください。受講中の怪我や事故について、当サービスおよび講師は一切の責任を負いません。"
      : null

  useEffect(() => {
    setAgreed(false)
  }, [resetKey, variant])

  return (
    <div className={cn("space-y-5", className)}>
      <details open className="group rounded-lg border border-border bg-muted/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-lg px-4 py-3 text-left text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
          <span>取引に関する重要な注意事項（必ずお読みください）</span>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-border px-4 py-3">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            {physicalSafetyNotice ? (
              <li className="list-none rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                <span className="font-semibold">【身体の安全に関する重要事項】</span>
                <br />
                {physicalSafetyNotice}
              </li>
            ) : null}
            {bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </details>

      <div className="flex items-start gap-3 text-sm text-foreground">
        <input
          id="trade-final-legal-agree"
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-border bg-background text-red-600 focus:ring-2 focus:ring-red-500"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <p className="min-w-0 flex-1 leading-relaxed text-foreground">
          <label htmlFor="trade-final-legal-agree" className="cursor-pointer">
            上記の注意事項、および
          </label>
          <button
            type="button"
            className="text-red-600 underline underline-offset-2 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => setLegalModal("terms")}
          >
            利用規約
          </button>
          <span className="text-foreground" aria-hidden>
            ・
          </span>
          <button
            type="button"
            className="text-red-600 underline underline-offset-2 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => setLegalModal("privacy")}
          >
            プライバシーポリシー
          </button>
          <label htmlFor="trade-final-legal-agree" className="cursor-pointer">
            に同意する
          </label>
        </p>
      </div>

      <LegalDocumentModal
        open={legalModal != null}
        kind={legalModal}
        onClose={() => setLegalModal(null)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {showCancelButton && onCancel ? (
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full border-border bg-muted font-medium text-foreground hover:bg-muted/80 sm:w-auto"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          className="h-11 w-full bg-red-600 text-white hover:bg-red-500 sm:min-w-[200px] sm:w-auto"
          disabled={!agreed || isLoading}
          onClick={() => void onConfirm()}
        >
          {isLoading ? "処理中..." : actionLabel}
        </Button>
      </div>
    </div>
  )
}
