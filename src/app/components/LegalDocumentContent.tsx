import type { LegalSection } from "@/lib/legal-content"

type LegalDocumentContentProps = {
  sections: readonly LegalSection[]
  className?: string
}

export function LegalDocumentContent({ sections, className }: LegalDocumentContentProps) {
  return (
    <div className={className}>
      {sections.map((section) => (
        <article key={section.title} className="space-y-2">
          <h2 className="text-base font-bold text-white">{section.title}</h2>
          <div className="space-y-1.5 text-sm leading-relaxed text-zinc-300">
            {section.body.map((line, index) => (
              <p key={`${section.title}-${index}`}>{line}</p>
            ))}
          </div>
        </article>
      ))}
      <p className="pt-1 text-sm text-zinc-400">以上</p>
    </div>
  )
}
