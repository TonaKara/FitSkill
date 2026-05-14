"use client"

import { useEffect } from "react"

const ACCENT_COLOR_STORAGE_KEY = "accent_color_value"
const DEFAULT_ACCENT_COLOR = "#e64a19"

export const ACCENT_COLOR_OPTIONS = [
  { id: "orange", label: "オレンジ（デフォルト）", value: "#e64a19" },
  /** 黄系として認識しやすい色（旧茶寄り amber #b45309 は #eab308 へ寄せる） */
  { id: "yellow", label: "黄", value: "#eab308" },
  { id: "blue", label: "青", value: "#2563eb" },
  /** primary-foreground との AA 確保（旧 #2f855a） */
  { id: "green", label: "緑", value: "#276749" },
] as const

/** localStorage に残った旧 Hex を現行パレットへ寄せる */
const LEGACY_ACCENT_HEX: Record<string, string> = {
  "#c62828": "#e64a19",
  "#d69e00": "#eab308",
  /** 旧 Yellow プリセット（茶寄り amber）→ 黄寄りに更新 */
  "#b45309": "#eab308",
  "#2f855a": "#276749",
}

function normalizeAccentHex(raw: string): string {
  const key = raw.trim().toLowerCase()
  return LEGACY_ACCENT_HEX[key] ?? raw.trim()
}

export function resolveStoredAccentColor(raw: string | null): string {
  if (!raw) {
    return DEFAULT_ACCENT_COLOR
  }
  const migrated = normalizeAccentHex(raw)
  const hit = ACCENT_COLOR_OPTIONS.find((option) => option.value.toLowerCase() === migrated.toLowerCase())
  return hit?.value ?? DEFAULT_ACCENT_COLOR
}

function resolveAccentColor(raw: string | null): string {
  return resolveStoredAccentColor(raw)
}

function applyAccentColor(color: string) {
  if (typeof document === "undefined") {
    return
  }
  document.documentElement.style.setProperty("--accent-color", color)
}

export function setAccentColorValue(color: string) {
  const resolved = resolveAccentColor(color)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, resolved)
  }
  applyAccentColor(resolved)
}

export function AccessibilityModeSync() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const accentRaw = window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY)
    const resolved = resolveStoredAccentColor(accentRaw)
    if (accentRaw != null && resolved !== accentRaw.trim()) {
      window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, resolved)
    }
    applyAccentColor(resolved)
  }, [])

  return null
}
