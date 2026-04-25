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
