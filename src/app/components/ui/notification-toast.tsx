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
          ? "border-red-700/80 bg-red-950/95 text-red-100 shadow-red-900/40"
          : "border-emerald-700/70 bg-emerald-950/90 text-emerald-100 shadow-emerald-900/30",
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
          className="h-7 w-7 shrink-0 rounded-md text-current hover:bg-white/10"
          onClick={onClose}
          aria-label="通知を閉じる"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
