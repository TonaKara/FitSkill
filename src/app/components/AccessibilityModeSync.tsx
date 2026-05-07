"use client"

import { useEffect } from "react"

const ACCENT_COLOR_STORAGE_KEY = "accent_color_value"
const DEFAULT_ACCENT_COLOR = "#c62828"

export const ACCENT_COLOR_OPTIONS = [
  { id: "red", label: "Red（デフォルト）", value: "#c62828" },
  { id: "yellow", label: "Yellow", value: "#d69e00" },
  { id: "blue", label: "Blue", value: "#2563eb" },
  { id: "green", label: "Green", value: "#2f855a" },
] as const

function resolveAccentColor(raw: string | null): string {
  if (!raw) {
    return DEFAULT_ACCENT_COLOR
  }
  const hit = ACCENT_COLOR_OPTIONS.find((option) => option.value === raw)
  return hit?.value ?? DEFAULT_ACCENT_COLOR
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
    applyAccentColor(resolveAccentColor(accentRaw))
  }, [])

  return null
}
