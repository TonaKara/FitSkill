"use client"

import { Globe } from "lucide-react"
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales"
import { useLocale, useSetLocale, useTranslations } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  /** "compact" は PC ヘッダー右、"inline" はモバイルメニュー内の横並び */
  variant?: "compact" | "inline"
  className?: string
}

const LOCALE_LABELS: Record<Locale, { short: string; long: string }> = {
  ja: { short: "JA", long: "日本語" },
  en: { short: "EN", long: "English" },
}

export function LanguageSwitcher({ variant = "compact", className }: LanguageSwitcherProps) {
  const locale = useLocale()
  const setLocale = useSetLocale()
  const t = useTranslations("language")

  if (variant === "inline") {
    return (
      <div
        role="radiogroup"
        aria-label={t("label")}
        className={cn("flex items-center gap-2", className)}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          {t("label")}
        </span>
        <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
          {SUPPORTED_LOCALES.map((code) => {
            const active = code === locale
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  if (!active) {
                    setLocale(code)
                  }
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-secondary",
                )}
              >
                {LOCALE_LABELS[code].short}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center overflow-hidden rounded-md border border-border bg-background",
        className,
      )}
    >
      <Globe className="ml-2 mr-1.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            title={LOCALE_LABELS[code].long}
            onClick={() => {
              if (!active) {
                setLocale(code)
              }
            }}
            className={cn(
              "px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-secondary",
            )}
          >
            {LOCALE_LABELS[code].short}
          </button>
        )
      })}
    </div>
  )
}
