"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import type { InquiryInboxListRow } from "@/lib/inquiry-messages"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"

export type InquiryPeerProfile = {
  display_name: string | null
  avatar_url: string | null
}

type InquiryInboxListProps = {
  threads: InquiryInboxListRow[]
  peerProfiles: Record<string, InquiryPeerProfile>
  skillTitles: Record<string, string>
  loading: boolean
  error: string | null
  activePeerId?: string | null
  emptyHint?: string
}

function threadHref(peerId: string): string {
  return `/inquiry/${encodeURIComponent(peerId)}`
}

export function InquiryInboxList({
  threads,
  peerProfiles,
  skillTitles,
  loading,
  error,
  activePeerId,
  emptyHint = "まだ相談メッセージはありません。スキル詳細から出品者に質問できます。",
}: InquiryInboxListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-red-500" aria-hidden />
        読み込み中...
      </div>
    )
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-red-400">{error}</p>
  }

  if (threads.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyHint}</p>
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {threads.map((t) => {
        const peer = peerProfiles[t.peer_id]
        const name = peer?.display_name?.trim() || "ユーザー"
        const avatarSrc = resolveProfileAvatarUrl(peer?.avatar_url ?? null, name)
        const skillTitle =
          skillTitles[t.last_origin_skill_id]?.trim() || `スキル #${t.last_origin_skill_id}`
        const active = activePeerId != null && activePeerId === t.peer_id

        return (
          <li key={t.peer_id}>
            <Link
              href={threadHref(t.peer_id)}
              className={`flex gap-3 px-3 py-3 transition-colors md:px-4 ${
                active ? "bg-red-950/40 ring-1 ring-inset ring-red-500/30" : "hover:bg-zinc-900/80"
              }`}
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-zinc-800">
                <Image src={avatarSrc} alt="" fill className="object-cover" sizes="48px" unoptimized />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="truncate font-semibold text-zinc-100">{name}</p>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <span className="rounded-full border border-red-500/35 bg-red-950/50 px-2 py-0.5 text-[10px] font-medium text-red-200">
                      {skillTitle.length > 18 ? `${skillTitle.slice(0, 18)}…` : skillTitle}
                    </span>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{t.last_content}</p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
