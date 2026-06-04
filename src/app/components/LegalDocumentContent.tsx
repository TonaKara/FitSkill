import type { LegalSection } from "@/lib/legal-content"

type LegalDocumentContentProps = {
  sections: readonly LegalSection[]
  className?: string
  endLabel?: string
  /**
   * 表示モード。
   *   - "default": サイト共通のテーマ変数 (`text-foreground` / `text-muted-foreground`) を使う既定挙動。
   *   - "plain":   GritVib 系の白黒ページ専用。テーマに依存せず固定のグレースケールでレンダリングする。
   */
  variant?: "default" | "plain"
}

export function LegalDocumentContent({
  sections,
  className,
  endLabel,
  variant = "default",
}: LegalDocumentContentProps) {
  const isPlain = variant === "plain"
  const headingClass = isPlain
    ? "text-base font-semibold text-black md:text-lg"
    : "text-base font-bold text-foreground"
  const bodyContainerClass = isPlain
    ? "space-y-2 text-sm leading-relaxed text-zinc-700"
    : "space-y-1.5 text-sm leading-relaxed text-muted-foreground"
  const endClass = isPlain
    ? "pt-1 text-sm text-zinc-600"
    : "pt-1 text-sm text-muted-foreground"

  return (
    <div className={className}>
      {sections.map((section) => (
        <article key={section.title} className="space-y-2">
          <h2 className={headingClass}>{section.title}</h2>
          <div className={bodyContainerClass}>
            {section.body.map((line, index) => (
              <p key={`${section.title}-${index}`}>{line}</p>
            ))}
          </div>
        </article>
      ))}
      {endLabel ? <p className={endClass}>{endLabel}</p> : null}
    </div>
  )
}
