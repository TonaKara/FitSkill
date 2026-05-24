import Link from "next/link"
import { CheckCircle2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { STRIPE_LINKS } from "@/japan-entry/_stripe-links"

/**
 * Stripe Checkout 完了後の遷移先（Thank You ページ）。
 * Payment Link の "Show a confirmation page hosted on your website" 設定で
 * このパスを指定してください: https://gritvib.com/japan-entry/thank-you
 */
export default function JapanEntryThankYouPage() {
  return (
    <div className="flex w-full items-center justify-center px-4 py-16 md:px-8 md:py-24">
      <Card className="mx-auto w-full max-w-2xl border-border bg-card">
        <CardContent className="space-y-8 px-6 py-10 text-center md:px-10">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary-readable">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Thank you for your order!
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              We will contact you via email within 24 hours.
              Please check your inbox.
            </p>
          </div>

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <MailCheck className="h-3.5 w-3.5" aria-hidden />
            Tip: if you don&rsquo;t see our email, please check your spam folder.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-6"
            >
              <Link href="/japan-entry">Back to Japan Entry</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full border-border bg-background text-foreground hover:border-primary hover:bg-muted sm:w-auto sm:px-6"
            >
              <a
                href={STRIPE_LINKS.customerPortal}
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage Subscription
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
