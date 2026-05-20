"use client"

import Link from "next/link"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { Button } from "@/components/ui/button"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { useTranslations } from "@/lib/i18n/useI18n"

export default function LogoAboutPage() {
  const t = useTranslations("brandLogo")

  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <section className="mb-8 rounded-2xl border border-primary/25 bg-accent p-6 md:p-8 dark:border-red-500/25 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-red-950/30">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{t("pageTitle")}</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
          >
            <Link href="/">{t("backToHome")}</Link>
          </Button>
        </div>

        <div className="p-1 md:p-2">
          <div className="flex h-52 w-full items-center justify-center rounded-xl border border-border bg-muted/50 md:h-72">
            <div className="inline-flex max-w-full items-center gap-4 px-2 md:gap-8">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#e64a19] md:h-40 md:w-40">
                <BrandMarkSvg className="h-20 w-20 md:h-32 md:w-32" />
              </div>
              <span className="text-4xl font-bold leading-none tracking-tight md:text-7xl">
                <span className="text-[#e64a19]">Grit</span>
                <span className="text-foreground">Vib</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("intentHeading")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p>{t("intent")}</p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("introHeading")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p>{t("intro1")}</p>
          <p>{t("intro2")}</p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("symbolHeading")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-muted/50 p-4">
            <h3 className="text-base font-semibold text-foreground">{t("symbol1Title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("symbol1Body")}</p>
          </article>
          <article className="rounded-xl border border-border bg-muted/50 p-4">
            <h3 className="text-base font-semibold text-foreground">{t("symbol2Title")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("symbol2Body")}</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("conceptHeading")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          <p className="font-semibold text-foreground">{t("conceptTagline")}</p>
          <p>{t("concept1")}</p>
          <p>{t("concept2")}</p>
          <p>{t("concept3")}</p>
        </div>
      </section>
    </main>
  )
}
