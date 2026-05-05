"use client"

import Link from "next/link"
import { Anton } from "next/font/google"
import { ArrowRight, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

const anton = Anton({ subsets: ["latin"], weight: "400" })

type HeroBannerProps = {
  onBrowseSkillsClick?: () => void
  heroStats?: {
    isAdmin: boolean
    skillsCount: number
    usersCount: number
  } | null
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

export function HeroBanner({ onBrowseSkillsClick, heroStats }: HeroBannerProps) {
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
            {/* Title */}
            <h1
              className={`${anton.className} mb-3 whitespace-nowrap text-xl font-black italic uppercase leading-tight tracking-tighter text-foreground sm:text-3xl md:text-4xl lg:text-5xl`}
            >
              <span className="inline-block">
                「楽しい」が、
                <span className="inline-block bg-gradient-to-b from-red-300 via-primary to-red-700 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(239,68,68,0.45)]">
                  共鳴
                </span>
                する場所。
              </span>
            </h1>
            
            {/* Description */}
            <p className="mb-6 text-sm text-muted-foreground md:text-base">
              プロのトレーナーから初心者まで、誰でもフィットネススキルを教えたり学んだりできるマーケットプレイス
            </p>
            
            {/* Stats (管理者のみ表示) */}
            {heroStats ? (
              <Stats isAdmin={heroStats.isAdmin} skillsCount={heroStats.skillsCount} usersCount={heroStats.usersCount} />
            ) : null}
            
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
