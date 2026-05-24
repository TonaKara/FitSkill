"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, BadgeCheck, Globe2, Handshake, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ALLOWED_EXTERNAL_TOOLS_ETC } from "@/lib/allowed-external-tools"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

type StepItem = {
  title: string
  body: string
}

function FlowStepArrow() {
  return (
    <svg
      viewBox="0 0 28 36"
      className="h-9 w-7 shrink-0 text-primary-readable"
      role="presentation"
      aria-hidden
    >
      <path fill="currentColor" d="M14 36 1 16h9V3h8v13h9L14 36z" />
    </svg>
  )
}

function FlowTimeline({ steps }: { steps: readonly StepItem[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => (
        <Fragment key={step.title}>
          <article className="relative w-full rounded-xl border border-border bg-muted/40 p-4 pl-12 md:pl-14">
            <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary-readable md:left-5 md:h-7 md:w-7">
              {index + 1}
            </div>
            <h3 className="text-sm font-semibold text-foreground md:text-base">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </article>
          {index < steps.length - 1 ? (
            <div className="flex h-11 w-full items-center justify-center md:h-12" aria-hidden>
              <FlowStepArrow />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}

export default function GuidePage() {
  const locale = useLocale()
  const tGuide = useTranslations("guide")
  const tSeller = useTranslations("guide.seller")
  const tBuyer = useTranslations("guide.buyer")
  const tSupport = useTranslations("guide.support")
  const tJapanEntry = useTranslations("guide.japanEntry")

  // 表示用ラベル: 日本語は ALLOWED_EXTERNAL_TOOLS_ETC をそのまま、英語時のみ自然な etc. 表記。
  const toolsLabel = locale === "en" ? "Zoom, YouTube, Discord, etc." : ALLOWED_EXTERNAL_TOOLS_ETC

  const sellerSteps = useMemo<readonly StepItem[]>(
    () => [
      { title: tSeller("step1Title"), body: tSeller("step1Body") },
      { title: tSeller("step2Title"), body: tSeller("step2Body") },
      { title: tSeller("step3Title"), body: tSeller("step3Body") },
      { title: tSeller("step4Title"), body: tSeller("step4Body") },
      { title: tSeller("step5Title"), body: tSeller("step5Body", { tools: toolsLabel }) },
      { title: tSeller("step6Title"), body: tSeller("step6Body") },
    ],
    [tSeller, toolsLabel],
  )

  const buyerSteps = useMemo<readonly StepItem[]>(
    () => [
      { title: tBuyer("step1Title"), body: tBuyer("step1Body") },
      { title: tBuyer("step2Title"), body: tBuyer("step2Body") },
      { title: tBuyer("step3Title"), body: tBuyer("step3Body", { tools: toolsLabel }) },
      { title: tBuyer("step4Title"), body: tBuyer("step4Body") },
      { title: tBuyer("step5Title"), body: tBuyer("step5Body") },
    ],
    [tBuyer, toolsLabel],
  )

  const supportItems = useMemo<readonly StepItem[]>(
    () => [
      { title: tSupport("disputeTitle"), body: tSupport("disputeBody") },
      { title: tSupport("contactTitle"), body: tSupport("contactBody") },
    ],
    [tSupport],
  )

  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <section className="rounded-2xl border border-primary/25 bg-accent p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tGuide("title")}</h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
          >
            <Link href="/">{tGuide("backToHome")}</Link>
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          {tGuide("intro")}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">{tSeller("heading")}</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          {tSeller("intro")}
        </p>
        <FlowTimeline steps={sellerSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">{tBuyer("heading")}</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          {tBuyer("intro")}
        </p>
        <FlowTimeline steps={buyerSteps} />
      </section>

      <section className="mt-8 rounded-2xl border border-primary/20 bg-accent/50 p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">{tSupport("heading")}</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground md:text-base">
          {tSupport("intro")}
        </p>
        <div className="space-y-3">
          {supportItems.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground md:text-base">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-accent via-accent/60 to-background p-5 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-primary-readable" aria-hidden />
          <h2 className="text-xl font-bold text-foreground">{tJapanEntry("heading")}</h2>
          <span className="ml-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-readable">
            English
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          {tJapanEntry("intro")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {tJapanEntry("body")}
        </p>
        <div className="mt-5">
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/japan-entry" prefetch={false}>
              {tJapanEntry("cta")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
