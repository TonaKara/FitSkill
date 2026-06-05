"use client"

import { useCallback, useState } from "react"
import { TalkConfirmDialog } from "@/talk/_talk-confirm-dialog"

type PendingConfirm = {
  message: string
  confirmLabel?: string
  resolve: (accepted: boolean) => void
}

export function useTalkConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((message: string, confirmLabel?: string) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, confirmLabel, resolve })
    })
  }, [])

  const dialog = pending ? (
    <TalkConfirmDialog
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      onConfirm={() => {
        pending.resolve(true)
        setPending(null)
      }}
      onCancel={() => {
        pending.resolve(false)
        setPending(null)
      }}
    />
  ) : null

  return { confirm, dialog }
}
