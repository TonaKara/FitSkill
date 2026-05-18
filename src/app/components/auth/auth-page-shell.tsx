import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type AuthPageShellProps = {
  children: ReactNode
  className?: string
}

/** ログイン・認証コールバックなど — ライト／ダーク両対応 */
export function AuthPageShell({ children, className }: AuthPageShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-100"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at top, color-mix(in srgb, var(--accent-color) 22%, transparent) 0%, transparent 45%), radial-gradient(circle at bottom, color-mix(in srgb, var(--accent-color) 14%, transparent) 0%, transparent 50%)",
        }}
      />
      {children}
    </div>
  )
}

export function AuthPageCard({ children, className }: AuthPageShellProps) {
  return (
    <div
      className={cn(
        "relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg",
        "dark:border-red-500/40 dark:bg-zinc-950/95 dark:shadow-[0_0_60px_rgba(230,74,25,0.25)]",
        className,
      )}
    >
      {children}
    </div>
  )
}
