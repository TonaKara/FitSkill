import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CmsSettingsPublicBlock } from "@/components/cms/CmsSettingsPublicBlock"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"

export default function SpecifiedCommercialTransactionsPage() {
  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground md:text-3xl">特定商取引法に基づく表記</h1>
        <Button
          asChild
          variant="outline"
          className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
        >
          <Link href="/">トップページに戻る</Link>
        </Button>
      </div>
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <CmsSettingsPublicBlock mode="full" />
      </section>
    </main>
  )
}
