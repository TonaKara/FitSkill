"use client"

import { useLocale, useTranslations } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

/** 1行目・2行目を明示し、スマホ〜PCでサイズと行間を調整 */
export function HeroBanner() {
  const t = useTranslations("hero")
  const locale = useLocale()
  // JA: スマホ幅でも 1 行表示を維持。EN: 文長があるためスマホでも自然に折返しさせる。
  const subtitleWhitespaceClass = locale === "ja" ? "whitespace-nowrap sm:whitespace-normal" : "whitespace-normal"
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-12">
      <div className="min-w-0 max-w-4xl">
        <h1 className="font-black tracking-tight text-neutral-900 dark:text-foreground">
          <span className="block text-[clamp(1.0625rem,3.6vw,1.875rem)] leading-snug text-neutral-700 dark:text-muted-foreground md:text-[1.875rem] md:leading-tight lg:text-[2rem]">
            {t("line1")}
          </span>
          <span className="mt-1.5 block text-[clamp(1.25rem,4.6vw,2.5rem)] leading-[1.2] md:mt-2 md:text-[2.5rem] md:leading-[1.15] lg:text-[3rem] lg:leading-[1.1]">
            {t("line2Prefix")}
            <span className="text-primary-readable">{t("line2Emphasis")}</span>
            {t("line2Suffix")}
          </span>
        </h1>
        <p
          className={cn(
            "mt-4 text-[0.6875rem] font-normal leading-tight text-neutral-500 dark:text-muted-foreground sm:max-w-xl sm:text-sm sm:leading-relaxed md:mt-5 md:text-base",
            subtitleWhitespaceClass,
          )}
        >
          {t("subtitle")}
        </p>
      </div>
    </section>
  )
}
