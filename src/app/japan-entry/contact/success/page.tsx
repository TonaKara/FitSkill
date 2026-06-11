import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function JapanEntryContactSuccessPage() {
  return (
    <div className="flex w-full items-center justify-center px-4 py-16 md:px-8 md:py-20">
      <Card className="mx-auto w-full max-w-2xl border-border bg-card">
        <CardContent className="space-y-8 px-6 py-10 text-center md:px-10">
          <div className="space-y-5">
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Message received
            </h1>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>Thank you for reaching out to GritVib&apos;s Japan Entry Support.</p>
              <p>
                We respond from Tokyo, in English, usually within 1–2 business days.
                For inquiries that don&apos;t require a reply, we may not follow up.
              </p>
              <p>Talk soon.</p>
            </div>
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
              <Link href="/">GritVib home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
