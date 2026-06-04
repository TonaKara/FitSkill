import { LegalFoot } from "@/talk/_legal-foot"

/**
 * GritVib の認証系画面（ログイン / はじめる）用シェル。
 * ビューポート高に固定し、ページ全体のスクロールを発生させない。
 */
export function TalkAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-white text-black">
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-6 py-4">
        {children}
      </main>
      <LegalFoot className="shrink-0 pt-4 pb-4" />
    </div>
  )
}
