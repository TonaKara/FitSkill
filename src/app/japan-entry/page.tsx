import Link from "next/link"
import { ArrowRight, Check, ShieldCheck, Sparkles, Zap } from "lucide-react"
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

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.18),_transparent_60%)]"
        aria-hidden
      />
      <div className="w-full px-4 py-20 text-center md:px-8 md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-readable">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Built by developers in Tokyo
        </span>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Instantly gain <span className="text-[#e64a19]">&lsquo;Trust&rsquo;</span> in Japan.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-foreground/90 sm:text-lg md:text-xl">
          Japanese users are sensitive to &lsquo;unnatural translation&rsquo; and often
          suspect fraud. Simple automated translation ruins your sales.
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Don&rsquo;t just translate &mdash; localize the vibe. Our team of native
          Japanese developers in Tokyo crafts content with perfect honorifics
          (<span className="font-semibold text-foreground">Keigo</span>) and
          cultural context that makes users feel secure and choose your brand.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#pricing"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
          >
            See pricing
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <a
            href="#features"
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted sm:w-auto"
          >
            How it works
          </a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          No retainers. No production. Just high-quality Japanese text, fast.
        </p>
      </div>
    </section>
  )
}

function FeatureSection() {
  return (
    <section id="features" className="border-b border-border bg-muted/30">
      <div className="w-full px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Why teams launching in Japan choose us
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            We&apos;re not an agency. We&apos;re builders who happen to write Japanese natively.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-3 md:gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article
                key={feature.title}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 md:p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary-readable">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground md:text-lg">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PriceTag({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <p className="flex items-baseline gap-1">
      <span className="text-4xl font-black tracking-tight text-foreground md:text-5xl">{primary}</span>
      {secondary ? (
        <span className="text-sm font-medium text-muted-foreground md:text-base">{secondary}</span>
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
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
          {tier.primary}
        </span>
        {tier.secondary ? (
          <span className="text-sm font-medium text-muted-foreground">{tier.secondary}</span>
        ) : null}
      </p>
      {tier.description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
      ) : null}
      <a
        href={tier.ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        data-stripe-plan={planId}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        {tier.ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
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
          ? "border-primary shadow-lg shadow-primary/10 md:scale-[1.02]"
          : "border-border",
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground shadow-sm">
          Most Popular
        </span>
      ) : null}
      <header className="space-y-2">
        <h3 className="text-lg font-bold tracking-tight text-foreground md:text-xl">
          {plan.name}
        </h3>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
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
              <span className="text-foreground/90">{feature.label}</span>
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
                "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors",
                cta.variant === "primary"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border border-border bg-background text-foreground hover:border-primary hover:bg-muted",
              )}
            >
              {cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function PricingSection() {
  return (
    <section id="pricing" className="border-b border-border bg-background">
      <div className="w-full px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Simple pricing. No retainers.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Start with a single post. Upgrade the day you need to.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:mt-14 md:grid-cols-3 md:items-stretch md:gap-7">
          {PRICING_PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prices in USD. Charged via Stripe. Taxes may apply depending on your region.
        </p>
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
    <section className="border-b border-border bg-muted/40">
      <div className="w-full px-4 py-12 md:px-8 md:py-16">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-base font-semibold text-foreground md:text-lg">
            How we work — and what we don&apos;t do
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary-readable" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section id="contact" className="border-b border-border bg-background">
      <div className="w-full px-4 py-16 text-center md:px-8 md:py-24">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
          Ready to land in Japan?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Pick a plan and check out via Stripe — or message us first if you&apos;d
          like to talk through your launch. We respond from Tokyo, in English.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
      <CtaSection />
    </>
  )
}
