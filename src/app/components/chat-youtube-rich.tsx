"use client"

import dynamic from "next/dynamic"
import { Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { extractYoutubeVideoId } from "@/lib/chat-link-payload"
import { cn } from "@/lib/utils"

const ReactPlayer = dynamic(() => import("react-player"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center bg-zinc-900">
      <div className="h-8 w-8 animate-pulse rounded bg-zinc-700" aria-hidden />
    </div>
  ),
})

type Props = {
  url: string
  mine: boolean
}

/** 吹き出し内に収まる YouTube 埋め込み（コントロール表示） */
export function ChatYoutubeRich({ url, mine }: Props) {
  const canEmbed = Boolean(extractYoutubeVideoId(url))

  return (
    <div
      className={cn(
        "mt-0 w-full min-w-0 max-w-full overflow-hidden rounded-xl border text-left shadow-sm",
        mine ? "border-red-900/60 bg-red-950/40" : "border-zinc-600 bg-zinc-950/80",
      )}
    >
      <p className="border-b border-zinc-700/80 px-3 py-2 text-xs font-semibold text-red-300">YouTube動画</p>
      {canEmbed ? (
        <div className="p-2">
          <div className="w-full min-w-0 overflow-hidden rounded-lg bg-black">
            <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
              <ReactPlayer
                src={url}
                width="100%"
                height="100%"
                controls
                style={{ position: "absolute", top: 0, left: 0 }}
                config={{
                  youtube: {
                    color: "white",
                  },
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 p-3">
        {!canEmbed ? (
          <p className="text-xs text-zinc-400">プレビューを表示できないURLです。リンクから開いてください。</p>
        ) : null}
        <Button
          asChild
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "w-full gap-2 border-zinc-500 font-medium",
            mine ? "border-red-200/40 bg-red-900/30 text-white hover:bg-red-900/50" : "",
          )}
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Video className="h-3.5 w-3.5" />
            YouTubeで開く
          </a>
        </Button>
      </div>
    </div>
  )
}
