"use client"

import Link from "next/link"
import { ArrowRight, Flame, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"

type HeroBannerProps = {
  onBrowseSkillsClick?: () => void
}

type HeroStatsResponse = {
  isAdmin: boolean
  skillsCount?: number
  activeUsersCount?: number
}

type StatsProps = {
  isAdmin: boolean
  skillsCount: number
  usersCount: number
}

function Stats({ isAdmin, skillsCount, usersCount }: StatsProps) {
  if (!isAdmin) {
    return null
  }

  return (
    <div className="mb-6 flex flex-wrap gap-6">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{skillsCount.toLocaleString("ja-JP")}</p>
          <p className="text-xs text-muted-foreground">登録スキル</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{usersCount.toLocaleString("ja-JP")}</p>
          <p className="text-xs text-muted-foreground">アクティブユーザー</p>
        </div>
      </div>
    </div>
  )
}

export function HeroBanner({ onBrowseSkillsClick }: HeroBannerProps) {
  const [statsLoading, setStatsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [skillsCount, setSkillsCount] = useState(0)
  const [activeUsersCount, setActiveUsersCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const loadStats = async () => {
      setStatsLoading(true)
      try {
        const response = await fetch("/api/hero-stats", { method: "GET" })
        if (!response.ok) {
          if (!cancelled) {
            setIsAdmin(false)
          }
          return
        }
        const payload = (await response.json()) as HeroStatsResponse
        if (cancelled) {
          return
        }
        setIsAdmin(payload.isAdmin === true)
        setSkillsCount(Number(payload.skillsCount ?? 0))
        setActiveUsersCount(Number(payload.activeUsersCount ?? 0))
      } finally {
        if (!cancelled) {
          setStatsLoading(false)
        }
      }
    }
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-background to-background border border-border">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary blur-3xl" />
      </div>
      
      <div className="relative px-6 py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Flame className="h-4 w-4" />
              <span>今週の人気スキル</span>
            </div>
            
            {/* Title */}
            <h1 className="mb-3 text-xl font-bold tracking-tight leading-tight text-foreground sm:text-2xl md:text-3xl lg:text-4xl">
              <span className="block text-balance">
                あなたの<span className="text-primary">フィットネススキル</span>を
              </span>
              <span className="block text-balance">シェアしよう</span>
            </h1>
            
            {/* Description */}
            <p className="mb-6 text-sm text-muted-foreground md:text-base">
              プロのトレーナーから初心者まで、誰でもフィットネススキルを教えたり学んだりできるマーケットプレイス
            </p>
            
            {/* Stats (管理者のみ表示) */}
            {statsLoading ? (
              <div className="mb-6 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
            ) : null}
            {!statsLoading ? <Stats isAdmin={isAdmin} skillsCount={skillsCount} usersCount={activeUsersCount} /> : null}
            
            {/* CTA */}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={onBrowseSkillsClick}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25"
              >
                スキルを探す
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-border hover:bg-secondary hover:text-foreground"
              >
                <Link href="/create-skill">スキルを出品する</Link>
              </Button>
            </div>
          </div>
          
          {/* Featured Image Area - Abstract representation */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-primary/20 blur-2xl" />
              <div className="relative grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                    <span className="text-4xl">💪</span>
                  </div>
                  <div className="h-20 w-24 rounded-xl bg-secondary flex items-center justify-center">
                    <span className="text-3xl">🧘</span>
                  </div>
                </div>
                <div className="space-y-3 pt-6">
                  <div className="h-20 w-24 rounded-xl bg-secondary flex items-center justify-center">
                    <span className="text-3xl">🥊</span>
                  </div>
                  <div className="h-24 w-24 rounded-xl bg-gradient-to-br from-primary/50 to-primary flex items-center justify-center">
                    <span className="text-4xl">🏃</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
