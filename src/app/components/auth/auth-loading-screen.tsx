import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type AuthLoadingScreenProps = {
  message: string
  className?: string
}

/** メール認証・セッション確認などのフルスクリーンロード */
export function AuthLoadingScreen({ message, className }: AuthLoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-foreground",
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-center text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
