import { CmsSettingsPublicBlock } from "@/components/cms/CmsSettingsPublicBlock"

export default function SpecifiedCommercialTransactionsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 text-zinc-100">
      <h1 className="mb-6 text-2xl font-black text-white md:text-3xl">特定商取引法に基づく表記</h1>
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 md:p-6">
        <CmsSettingsPublicBlock mode="full" />
      </section>
    </main>
  )
}
