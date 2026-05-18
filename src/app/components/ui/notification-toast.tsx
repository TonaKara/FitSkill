import { AlertCircle, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppNotice } from "@/lib/notifications"

type NotificationToastProps = {
  notice: AppNotice
  onClose: () => void
}

export function NotificationToast({ notice, onClose }: NotificationToastProps) {
  const isError = notice.variant === "error"

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[70] w-[min(92vw,28rem)] rounded-lg border px-4 py-3 shadow-2xl backdrop-blur-sm",
        isError
          ? "border-red-300 bg-red-50 text-red-900 shadow-red-200/60 dark:border-red-700/80 dark:bg-red-950/95 dark:text-red-100 dark:shadow-red-900/40"
          : "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-emerald-200/70 dark:border-emerald-700/70 dark:bg-emerald-950/90 dark:text-emerald-100 dark:shadow-emerald-900/30",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {isError ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
        <p className="flex-1 text-sm leading-relaxed">{notice.message}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-md text-current hover:bg-black/5 dark:hover:bg-white/10"
          onClick={onClose}
          aria-label="通知を閉じる"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
