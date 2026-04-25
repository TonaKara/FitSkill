"use client"

import { Home, Search, PlusCircle, MessageCircle, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const navItems = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "search", label: "探す", icon: Search },
  { id: "create", label: "出品", icon: PlusCircle },
  { id: "messages", label: "メッセージ", icon: MessageCircle },
  { id: "profile", label: "マイページ", icon: User },
]

export function BottomNav() {
  const [activeItem, setActiveItem] = useState("home")

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id
          const isCreate = item.id === "create"
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                isCreate && "relative -mt-4"
              )}
            >
              {isCreate ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                  isCreate && "text-primary"
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
