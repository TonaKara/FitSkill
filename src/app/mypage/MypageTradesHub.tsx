"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  parseTradesPanel,
  parseTradesSide,
  type TradesPanel,
  type TradesSide,
} from "@/lib/mypage-trades"
import type { MypageModePreference } from "@/lib/mypage-mode-preference"
import { useTranslations } from "@/lib/i18n/useI18n"

type MypageTradesHubProps = {
  mode: MypageModePreference
  side: TradesSide
  panel: TradesPanel
  onSideChange: (side: TradesSide) => void
  onPanelChange: (panel: TradesPanel) => void
}

export function MypageTradesHub({ mode, side, panel, onSideChange, onPanelChange }: MypageTradesHubProps) {
  const tMy = useTranslations("mypage")
  const resolvedSide = parseTradesSide(side, mode)
  const resolvedPanel = parseTradesPanel(panel)

  const mobileTradeTabs = useMemo<
    {
      id: string
      label: string
      isActive: (side: TradesSide, panel: TradesPanel) => boolean
      apply: (handlers: { onSideChange: (side: TradesSide) => void; onPanelChange: (panel: TradesPanel) => void }) => void
    }[]
  >(
    () => [
      {
        id: "offers-buyer",
        label: tMy("tabPreOffer"),
        isActive: (side, panel) => panel === "offers" && side === "buyer",
        apply: ({ onSideChange, onPanelChange }) => {
          onSideChange("buyer")
          onPanelChange("offers")
        },
      },
      {
        id: "active",
        label: tMy("tabActive"),
        isActive: (_side, panel) => panel === "active",
        apply: ({ onPanelChange }) => onPanelChange("active"),
      },
      {
        id: "history",
        label: tMy("tabHistory"),
        isActive: (_side, panel) => panel === "history",
        apply: ({ onPanelChange }) => onPanelChange("history"),
      },
      {
        id: "offers-seller",
        label: tMy("tabIncomingRequests"),
        isActive: (side, panel) => panel === "offers" && side === "seller",
        apply: ({ onSideChange, onPanelChange }) => {
          onSideChange("seller")
          onPanelChange("offers")
        },
      },
    ],
    [tMy],
  )

  return (
    <div className="mb-8 space-y-6">
      <header className="space-y-2 px-0.5">
        <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tMy("tradesHubTitle")}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tMy("tradesHubSubtitle")}
        </p>
      </header>

      <div className="space-y-5">
        <div
          className="border-b border-border"
          role="tablist"
          aria-label={tMy("sideTabAria")}
        >
          <div className="flex w-full">
            <button
              type="button"
              role="tab"
              aria-selected={resolvedSide === "buyer"}
              onClick={() => onSideChange("buyer")}
              className={cn(
                "flex-1 px-2 pb-3.5 pt-2 text-center text-sm font-semibold transition-colors sm:text-base",
                resolvedSide === "buyer"
                  ? "-mb-px border-b-2 border-primary text-white"
                  : "text-muted-foreground hover:text-muted-foreground",
              )}
            >
              {tMy("sideBuyer")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={resolvedSide === "seller"}
              onClick={() => onSideChange("seller")}
              className={cn(
                "flex-1 px-2 pb-3.5 pt-2 text-center text-sm font-semibold transition-colors sm:text-base",
                resolvedSide === "seller"
                  ? "-mb-px border-b-2 border-primary text-white"
                  : "text-muted-foreground hover:text-muted-foreground",
              )}
            >
              {tMy("sideSeller")}
            </button>
          </div>
        </div>

        <div
          className="-mx-0.5 overflow-x-auto px-0.5 pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={tMy("statusTabAria")}
        >
          <div className="flex flex-nowrap gap-2">
            {mobileTradeTabs.map((tab) => {
              const active = tab.isActive(resolvedSide, resolvedPanel)
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => tab.apply({ onSideChange, onPanelChange })}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-[13px]",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "border border-border/90 bg-background/50 text-muted-foreground hover:border-zinc-600 hover:bg-background hover:text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
