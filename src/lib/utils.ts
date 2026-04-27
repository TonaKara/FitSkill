import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Supabase の uuid 文字列かどうか（厳密め） */
export function isUuidString(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

/** Server Action や非標準の throw のメッセージを取り出す */
export function getUnknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const m = error.message?.trim()
    if (m) {
      return m
    }
    const digest = (error as Error & { digest?: string }).digest
    if (typeof digest === "string" && digest.trim()) {
      return `予期せぬエラーが発生しました（${digest.slice(0, 12)}）`
    }
    return fallback
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim()
  }
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) {
      return m.trim()
    }
  }
  return fallback
}
