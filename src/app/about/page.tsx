"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { useTranslations } from "@/lib/i18n/useI18n"

export default function AboutPage() {
  const t = useTranslations("about")

  const conceptPoints = [t("conceptPoint1"), t("conceptPoint2"), t("conceptPoint3")]

  const featureCards = [
    { title: t("feature1Title"), body: t("feature1Body") },
    { title: t("feature2Title"), body: t("feature2Body") },
    { title: t("feature3Title"), body: t("feature3Body") },
  ]

  const safetyItems = [
    { title: t("safety1Title"), body: t("safety1Body") },
    { title: t("safety2Title"), body: t("safety2Body") },
  ]

  const operatorParagraphs = [t("operatorParagraph1"), t("operatorParagraph2")]

  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <div className="mb-8 overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{t("title")}</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
          >
            <Link href="/">{t("backToHome")}</Link>
          </Button>
        </div>
        <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
          {t("lead")}
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("conceptHeading")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {conceptPoints.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-foreground">{t("featuresHeading")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("safetyHeading")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("safetyIntro")}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {safetyItems.map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-accent/50 p-5 md:p-7">
        <h2 className="text-xl font-bold text-foreground">{t("operatorHeading")}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {operatorParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </main>
  )
}
