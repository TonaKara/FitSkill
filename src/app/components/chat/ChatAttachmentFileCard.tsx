"use client"

import { Download, FileText, Loader2 } from "lucide-react"
import { formatChatFileSize } from "@/lib/chat-file-attachments"
import { useTranslations } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

type ChatAttachmentFileCardProps = {
  fileName: string
  fileSizeBytes: number | null
  downloadUrl: string | null
  loading?: boolean
  failed?: boolean
  /** 送信前プレビュー（ダウンロードリンクなし） */
  pending?: boolean
  mine?: boolean
  className?: string
}

export function ChatAttachmentFileCard({
  fileName,
  fileSizeBytes,
  downloadUrl,
  loading,
  failed,
  pending,
  mine,
  className,
}: ChatAttachmentFileCardProps) {
  const t = useTranslations("chatRich.file")
  const sizeLabel =
    fileSizeBytes != null && fileSizeBytes > 0 ? formatChatFileSize(fileSizeBytes) : null

  if (failed) {
    return (
      <p className={cn("text-xs", mine ? "text-red-100/90" : "text-amber-800 dark:text-amber-200/90")}>
        {t("loadFailed")}
      </p>
    )
  }

  if (pending) {
    return (
      <div
        className={cn(
          "flex min-w-[220px] max-w-full items-center gap-3 rounded-lg border px-3 py-3",
          mine ? "border-red-400/40 bg-red-700/30" : "border-border bg-background/80",
          className,
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            mine ? "bg-red-800/50 text-red-50" : "bg-muted text-foreground",
          )}
          aria-hidden
        >
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn("block truncate text-sm font-medium", mine ? "text-red-50" : "text-foreground")}
            title={fileName}
          >
            {fileName}
          </span>
          {sizeLabel ? (
            <span className={cn("mt-0.5 block text-xs", mine ? "text-red-100/80" : "text-muted-foreground")}>
              {sizeLabel}
            </span>
          ) : null}
        </span>
      </div>
    )
  }

  if (loading || !downloadUrl) {
    return (
      <div
        className={cn(
          "flex min-w-[220px] max-w-full items-center gap-3 rounded-lg border px-3 py-3",
          mine ? "border-red-400/40 bg-red-700/30" : "border-border bg-background/80",
          className,
        )}
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-red-500" aria-hidden />
        <span className={cn("text-sm", mine ? "text-red-50/90" : "text-muted-foreground")}>
          {t("preparing")}
        </span>
      </div>
    )
  }

  return (
    <a
      href={downloadUrl}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex min-w-[220px] max-w-full items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
        mine
          ? "border-red-400/40 bg-red-700/25 hover:bg-red-700/40"
          : "border-border bg-background/90 hover:bg-muted/80",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          mine ? "bg-red-800/50 text-red-50" : "bg-muted text-foreground",
        )}
        aria-hidden
      >
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            mine ? "text-red-50" : "text-foreground",
          )}
          title={fileName}
        >
          {fileName}
        </span>
        {sizeLabel ? (
          <span className={cn("mt-0.5 block text-xs", mine ? "text-red-100/80" : "text-muted-foreground")}>
            {sizeLabel}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
          mine ? "bg-red-800/60 text-red-50" : "bg-muted text-foreground",
        )}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {t("save")}
      </span>
    </a>
  )
}
