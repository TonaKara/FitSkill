import { cn } from "@/lib/utils"

/** 管理画面共通のセマンティッククラス（ライト／ダーク両対応） */
export const adminUi = {
  label: "text-sm font-medium text-foreground",
  labelSection: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  bodyMuted: "text-sm text-muted-foreground",
  bodyMutedXs: "text-xs text-muted-foreground",
  input:
    "rounded-md border border-border bg-background text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  select:
    "h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring",
  tableHead: "px-3 py-2 font-semibold text-muted-foreground",
  tableCell: "max-w-[260px] px-3 py-2 text-foreground",
  tableRow: "cursor-pointer border-b border-border transition-colors hover:bg-muted/60",
  panel: "rounded-xl border border-border bg-card text-card-foreground",
  modal: "w-full max-w-2xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",
  navActive: "bg-primary text-primary-foreground",
  navInactive: "text-muted-foreground hover:bg-muted hover:text-foreground",
  backLink:
    "border border-border bg-muted/50 text-foreground transition-colors hover:border-primary hover:bg-muted",
  btnOutline:
    "border-border bg-background text-foreground hover:bg-muted",
  tabInactive: "bg-muted text-muted-foreground hover:bg-muted/80",
  filterInput: "max-w-xl border-border bg-background text-foreground placeholder:text-muted-foreground",
} as const

export function adminStatusBadgeClass(status: string): string {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
  switch (status) {
    case "pending":
      return cn(
        base,
        "bg-red-100 text-red-800 ring-red-600/25 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/40",
      )
    case "investigating":
      return cn(
        base,
        "bg-blue-100 text-blue-800 ring-blue-600/25 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-500/40",
      )
    case "resolved":
    case "completed":
      return cn(
        base,
        "bg-emerald-100 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35",
      )
    case "ignored":
    case "rejected":
      return cn(base, "bg-muted text-muted-foreground ring-border")
    case "banned":
      return cn(
        base,
        "bg-red-100 text-red-800 ring-red-600/25 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/40",
      )
    case "active":
      return cn(
        base,
        "bg-emerald-100 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/40",
      )
    case "disputed":
    case "open":
      return cn(
        base,
        "bg-amber-100 text-amber-900 ring-amber-600/25 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-500/35",
      )
    case "refunded":
    case "canceled":
      return cn(
        base,
        "bg-violet-100 text-violet-800 ring-violet-600/25 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-500/40",
      )
    case "approval_pending":
      return cn(
        base,
        "bg-sky-100 text-sky-800 ring-sky-600/25 dark:bg-sky-950/60 dark:text-sky-200 dark:ring-sky-500/35",
      )
    default:
      return cn(base, "bg-muted text-muted-foreground ring-border")
  }
}
