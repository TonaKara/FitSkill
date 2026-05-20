"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { getPrivacySections, getTermsSections } from "@/lib/legal-content"
import { cn } from "@/lib/utils"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

export type LegalDocumentKind = "terms" | "privacy"

type LegalDocumentModalProps = {
  open: boolean
  kind: LegalDocumentKind | null
  onClose: () => void
  /** 親がモーダル内のとき、さらに前面に出す */
  zClassName?: string
}

export function LegalDocumentModal({ open, kind, onClose, zClassName = "z-[10050]" }: LegalDocumentModalProps) {
  const locale = useLocale()
  const tLegal = useTranslations("legal")
  const tCommon = useTranslations("common")
  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (typeof document === "undefined" || !open || !kind) {
    return null
  }

  const sections = kind === "terms" ? getTermsSections(locale) : getPrivacySections(locale)
  const title = kind === "terms" ? tLegal("termsTitle") : tLegal("privacyTitle")
  const endLabel = tLegal("documentEnd")

  return createPortal(
    <div
      className={cn("fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/50 p-4", zClassName)}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-doc-modal-title"
        className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <h2 id="legal-doc-modal-title" className="pr-2 text-base font-bold text-foreground sm:text-lg">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[min(70dvh,560px)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <LegalDocumentContent
            sections={sections}
            className="space-y-5 rounded-lg border border-border bg-muted/40 p-4 sm:p-5"
            endLabel={endLabel}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
