import Link from "next/link"
import { ArrowRight, Check, ChevronDown, ShieldCheck, Sparkles, Zap } from "lucide-react"
import { HeroSection } from "@/japan-entry/_hero-section"
import { Reveal } from "@/japan-entry/_reveal"
import { STRIPE_LINKS } from "@/japan-entry/_stripe-links"
import { cn } from "@/lib/utils"

type PlanFeature = { label: string }

/**
 * A La Carte 等、1 つのプラン内に複数の価格・購入動線がある場合の単位。
 * tier ごとに独立した CTA（Stripe リンク）を持たせる。
 * description は任意：価格 + 名前で十分な場合は省略してコンパクトに表示する。
 */
type PriceTier = {
  primary: string
  secondary?: string
  description?: string
  ctaLabel: string
  ctaHref: string
}

type PricingPlan = {
  id: "a-la-carte" | "standard" | "premium"
  name: string
  tagline: string
  /** 単一価格プラン（Standard / Premium 等）で使う。priceTiers と排他。 */
  priceLines?: { primary: string; secondary?: string }
  /** 複数価格プラン（A La Carte 等）で使う。各 tier に CTA を内包。 */
  priceTiers?: PriceTier[]
  features: PlanFeature[]
  /** 単一価格プランで価格セクションの下に置く CTA。priceTiers モードでは未使用。 */
  ctas?: { label: string; href: string; variant: "primary" | "secondary" }[]
  highlight?: boolean
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "a-la-carte",
    name: "A La Carte",
    tagline: "Pay-as-you-go for specific needs.",
    priceTiers: [
      {
        primary: "$30",
        secondary: "Single Post Translation",
        ctaLabel: "Buy a Post — $30",
        ctaHref: STRIPE_LINKS.alaCartePost,
      },
      {
        primary: "$399",
        secondary: "Legal & Compliance Pack (One-time)",
        ctaLabel: "Get Legal Pack — $399",
        ctaHref: STRIPE_LINKS.alaCarteLegal,
      },
    ],
    features: [],
  },
  {
    id: "standard",
    name: "Standard",
    priceLines: { primary: "$499", secondary: "/ month" },
    tagline: "Best for building your foundation in Japan.",
    features: [
      { label: "Up to 15 Translations per month (Ads, SNS, or UI)." },
      { label: "15 Engagement reply drafts." },
      {
        label:
          "Ongoing Legal & Compliance Maintenance (Updating ToS / Privacy Policy as your service grows).",
      },
      { label: "Cultural tone calibration." },
    ],
    ctas: [{ label: "Start Standard", href: STRIPE_LINKS.standard, variant: "primary" }],
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    priceLines: { primary: "$899", secondary: "/ month" },
    tagline: "Full-scale support for serious market entry.",
    features: [
      { label: "Unlimited translations & engagement drafts." },
      { label: "Ongoing Legal & Compliance Maintenance." },
      { label: "Japan Market & Competitor Research." },
      { label: "Cultural Strategic Consulting (UI/UX localization & local trends)." },
      { label: "Dedicated Discord channel for instant support." },
    ],
    ctas: [{ label: "Start Premium", href: STRIPE_LINKS.premium, variant: "primary" }],
  },
]

const FEATURES = [
  {
    icon: Sparkles,
    title: "We localize the Vibe.",
    body: "Translation alone won't move people in Japan. We rewrite for tone, context, and culture — so your message lands the way it does at home.",
  },
  {
    icon: ShieldCheck,
    title: "No production. No operations.",
    body: "You keep full control of your accounts, assets, and brand. We deliver high-quality Japanese text — that's it. No posting, no impersonation, no risk.",
  },
  {
    icon: Zap,
    title: "Quick turnaround for fast movers.",
    body: "Built by developers in Tokyo who ship daily. Most requests turn around within 24–48 hours so your launch cadence never slows down.",
  },
] as const

type FaqItem = { question: string; answer: string }

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "Do you offer phone or video calls?",
    answer:
      "To ensure the best quality and speed, all communication is handled via Discord or Email. This asynchronous approach allows us to bridge time zones effectively and keep a clear log of all project details.",
  },
  {
    question: "Is this a consulting service?",
    answer:
      "I focus on execution. While I provide cultural guidance, my primary role is to \u201Cget things done\u201D — from localizing your UI to managing your SNS and legal compliance.",
  },
  {
    question: "How long does it take to get a response?",
    answer:
      "I prioritize my clients and aim to respond to all messages within 24 hours.",
  },
  {
    question: "Do you handle legal documents?",
    answer:
      "Yes, I specialize in localizing Terms of Service and Privacy Policies for the Japanese market. Please note that while I follow standard Japanese practices, this is not a substitute for formal legal counsel.",
  },
  {
    question: "How do I manage my subscription?",
    answer:
      "You can access the \u201CBilling & Purchase History\u201D portal anytime from the footer to manage your plan or download invoices.",
  },
] as const

function FeatureSection() {
  return (
    <section
      id="features"
      className="relative border-b border-border bg-muted/50 dark:bg-muted/30"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 md:px-8 md:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
              Why us
            </span>
            <h2 className="mt-4 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
              Why teams launching in Japan choose us
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              We&apos;re not an agency. We&apos;re builders who happen to write Japanese natively.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-5 md:mt-14 md:grid-cols-3 md:gap-6">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Reveal
                key={feature.title}
                delay={0.15 + index * 0.12}
                className="h-full"
              >
                <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40 md:p-7">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary-readable">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-balance text-base font-semibold leading-snug text-foreground md:text-lg">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PriceTag({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
      <span className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
        {primary}
      </span>
      {secondary ? (
        <span className="whitespace-nowrap text-sm font-medium text-muted-foreground md:text-base">
          {secondary}
        </span>
      ) : null}
    </p>
  )
}

function PriceTierBlock({
  tier,
  planId,
}: {
  tier: PriceTier
  planId: PricingPlan["id"]
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
          {tier.primary}
        </span>
        {tier.secondary ? (
          <span className="text-pretty text-sm font-medium text-muted-foreground">
            {tier.secondary}
          </span>
        ) : null}
      </div>
      {tier.description ? (
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          {tier.description}
        </p>
      ) : null}
      <a
        href={tier.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        data-stripe-plan={planId}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <span className="text-pretty">{tier.ctaLabel}</span>
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </a>
    </div>
  )
}

function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-shadow md:p-7",
        plan.highlight
          ? "border-primary shadow-xl shadow-primary/20 md:scale-[1.02]"
          : "border-border shadow-md",
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground shadow-sm sm:tracking-[0.18em]">
          Most Popular
        </span>
      ) : null}
      <header className="space-y-2">
        <h3 className="text-balance text-lg font-bold tracking-tight text-foreground md:text-xl">
          {plan.name}
        </h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {plan.tagline}
        </p>
      </header>

      {plan.priceTiers && plan.priceTiers.length > 0 ? (
        <div className="mt-5 space-y-3">
          {plan.priceTiers.map((tier) => (
            <PriceTierBlock key={tier.ctaHref} tier={tier} planId={plan.id} />
          ))}
        </div>
      ) : plan.priceLines ? (
        <div className="mt-5">
          <PriceTag
            primary={plan.priceLines.primary}
            secondary={plan.priceLines.secondary}
          />
        </div>
      ) : null}

      {plan.features.length > 0 ? (
        <ul className="mt-6 space-y-3 text-sm">
          {plan.features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-readable" aria-hidden />
              <span className="text-pretty leading-relaxed text-foreground/90">
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {plan.ctas && plan.ctas.length > 0 ? (
        <div className="mt-7 flex flex-col gap-2 md:mt-auto md:pt-7">
          {plan.ctas.map((cta) => (
            <a
              key={cta.href}
              href={cta.href}
              target="_blank"
              rel="noopener noreferrer"
              data-stripe-plan={plan.id}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold transition-colors",
                cta.variant === "primary"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border border-border bg-background text-foreground hover:border-primary hover:bg-muted",
              )}
            >
              {cta.label}
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-y-2 border-primary/20 bg-gradient-to-b from-[#fff5f1] via-[#fff9f6] to-[#fff5f1] dark:from-[#1a0e09] dark:via-[#140a06] dark:to-[#1a0e09]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[320px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.18),_transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[260px] bg-[radial-gradient(ellipse_at_bottom,_rgba(230,74,25,0.12),_transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 md:px-8 md:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-readable shadow-sm sm:text-xs sm:tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Pricing
            </span>
            <h2 className="mt-4 text-balance text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Simple pricing. No retainers.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              Start with a single post. Upgrade the day you need to.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3 md:items-stretch md:gap-7">
          {PRICING_PLANS.map((plan, index) => (
            <Reveal
              key={plan.id}
              delay={0.2 + index * 0.14}
              className="h-full"
            >
              <PricingCard plan={plan} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.4}>
          <p className="mt-10 text-pretty text-center text-xs text-muted-foreground">
            Prices in USD. Charged via Stripe. Taxes may apply depending on your region.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function DisclaimerSection() {
  const points = [
    "Client provides visual assets. We provide the Japanese text.",
    "No SNS posting operations to ensure your security and privacy.",
  ]
  return (
    <section className="border-b border-border bg-muted/50 dark:bg-muted/30">
      <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-6 md:px-8 md:py-20">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
            <h2 className="text-balance text-base font-semibold leading-snug text-foreground md:text-lg">
              How we work — and what we don&apos;t do
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-primary-readable" aria-hidden />
                  <span className="text-pretty">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function FaqSection() {
  return (
    <section
      id="faq"
      className="border-b border-border bg-background"
    >
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-6 md:px-8 md:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
              FAQ
            </span>
            <h2 className="mt-4 text-balance text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              Everything you need to know before getting started.
            </p>
          </div>
        </Reveal>
        <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-3 md:mt-14">
          {FAQ_ITEMS.map((item, index) => (
            <Reveal key={item.question} delay={0.15 + index * 0.08} y={20}>
              <details
                className="group rounded-2xl border border-border bg-card shadow-sm transition-colors open:border-primary/40 hover:border-primary/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 text-left text-sm font-semibold text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 md:p-6 md:text-base [&::-webkit-details-marker]:hidden">
                  <span className="text-balance">{item.question}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 group-open:text-primary-readable"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-border/60 px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                    {item.answer}
                  </p>
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden border-b border-border bg-background"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[420px] bg-[radial-gradient(ellipse_at_bottom,_rgba(230,74,25,0.16),_transparent_65%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-6 md:px-8 md:py-28">
        <Reveal>
          <h2 className="text-balance text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Ready to land in Japan?
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            Pick a plan and check out via Stripe — or message us first if you&apos;d
            like to talk through your launch. We respond from Tokyo, in English.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              Choose a plan
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link
              href="/japan-entry/contact"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted sm:w-auto"
            >
              Talk to us
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function JapanEntryPage() {
  return (
    <>
      <HeroSection />
      <FeatureSection />
      <PricingSection />
      <DisclaimerSection />
      <FaqSection />
      <CtaSection />
    </>
  )
}
