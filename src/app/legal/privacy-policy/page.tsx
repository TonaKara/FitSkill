import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { PRIVACY_SECTIONS } from "@/lib/legal-content"

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 text-zinc-100">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white md:text-3xl">FitSkill プライバシーポリシー</h1>
        <Button
          asChild
          variant="outline"
          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
        >
          <Link href="/">トップページに戻る</Link>
        </Button>
      </div>
      <section className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5 md:p-6">
        <LegalDocumentContent sections={PRIVACY_SECTIONS} className="space-y-5" />
      </section>
    </main>
  )
}
