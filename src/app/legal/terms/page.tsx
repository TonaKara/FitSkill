import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { TERMS_SECTIONS } from "@/lib/legal-content"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"

export default function TermsPage() {
  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground md:text-3xl">GritVib 利用規約</h1>
        <Button
          asChild
          variant="outline"
          className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
        >
          <Link href="/">トップページに戻る</Link>
        </Button>
      </div>
      <section className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5 md:p-6">
        <LegalDocumentContent sections={TERMS_SECTIONS} className="space-y-5" />
      </section>
    </main>
  )
}

