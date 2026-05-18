import type { MypageModePreference } from "@/lib/mypage-mode-preference"

export type TradesSide = "buyer" | "seller"
export type TradesPanel = "offers" | "inquiry" | "active" | "history"

export type TradesContentSection = "requests" | "inquiry" | "learning" | "teaching" | "transactions"

/** 取引ハブ内パネル（相談・メッセージ等）の共通ラッパー */
export const TRADES_HUB_PANEL_OUTER = "w-full"
export const TRADES_HUB_PANEL_CARD = "overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
export const TRADES_HUB_PANEL_CARD_BODY = "p-4 md:p-6"

export function parseTradesSide(raw: string | null, fallbackMode: MypageModePreference): TradesSide {
  if (raw === "seller" || raw === "buyer") {
    return raw
  }
  return fallbackMode === "instructor" ? "seller" : "buyer"
}

export function parseTradesPanel(raw: string | null): TradesPanel {
  if (raw === "offers" || raw === "inquiry" || raw === "active" || raw === "history") {
    return raw
  }
  return "active"
}

/** 取引ハブ内のサブタブが実際に表示する既存セクション */
export function resolveTradesContentSection(side: TradesSide, panel: TradesPanel): TradesContentSection {
  if (panel === "offers") {
    return "requests"
  }
  if (panel === "inquiry") {
    return "inquiry"
  }
  if (panel === "active") {
    return side === "buyer" ? "learning" : "teaching"
  }
  return "transactions"
}

export function tradesPanelLabel(panel: TradesPanel): string {
  switch (panel) {
    case "offers":
      return "事前オファー"
    case "inquiry":
      return "相談・メッセージ"
    case "active":
      return "進行中"
    case "history":
      return "取引履歴"
  }
}
