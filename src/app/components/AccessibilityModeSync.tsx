"use client"

import { useEffect } from "react"

const ACCENT_COLOR_STORAGE_KEY = "accent_color_value"
const DEFAULT_ACCENT_COLOR = "#c62828"

export const ACCENT_COLOR_OPTIONS = [
  { id: "red", label: "Red（デフォルト）", value: "#c62828" },
  /** ボタン塗りと前景のコントラスト改善（旧 #d69e00） */
  { id: "yellow", label: "Yellow", value: "#b45309" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  /** primary-foreground との AA 確保（旧 #2f855a） */
  { id: "green", label: "Green", value: "#276749" },
] as const

/** localStorage に残った旧 Hex を現行パレットへ寄せる */
const LEGACY_ACCENT_HEX: Record<string, string> = {
  "#d69e00": "#b45309",
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
