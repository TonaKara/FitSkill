import type { LegalSection } from "@/lib/legal-content"

type LegalDocumentContentProps = {
  sections: readonly LegalSection[]
  className?: string
  endLabel?: string
}

export function LegalDocumentContent({ sections, className, endLabel }: LegalDocumentContentProps) {
  return (
    <div className={className}>
      {sections.map((section) => (
        <article key={section.title} className="space-y-2">
          <h2 className="text-base font-bold text-foreground">{section.title}</h2>
          <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {section.body.map((line, index) => (
              <p key={`${section.title}-${index}`}>{line}</p>
            ))}
          </div>
        </article>
      ))}
      {endLabel ? <p className="pt-1 text-sm text-muted-foreground">{endLabel}</p> : null}
    </div>
  )
}
