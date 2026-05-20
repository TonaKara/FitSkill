"use client"

import Image from "next/image"
import { User } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/useI18n"
import { getProfileAvatarUrl } from "@/lib/profile-avatar"

export type ProfileAvatarProps = {
  /** DB の avatar_url または blob プレビュー URL */
  avatarUrl?: string | null
  /** 明示的な画像 URL（avatarUrl より優先） */
  src?: string | null
  alt?: string
  className?: string
  ringClassName?: string
  /** 既定は `rounded-full`。角丸矩形にする場合は `rounded-xl` など */
  roundedClassName?: string
  iconClassName?: string
  unoptimized?: boolean
  sizes?: string
}

/** プロフィール画像。未設定時は人型シルエット（ライト: slate / ダーク: neutral） */
export function ProfileAvatar({
  avatarUrl,
  src,
  alt = "",
  className,
  ringClassName,
  roundedClassName = "rounded-full",
  iconClassName,
  unoptimized = true,
  sizes = "128px",
}: ProfileAvatarProps) {
  const tAria = useTranslations("aria")
  const imageSrc = src?.trim() || getProfileAvatarUrl(avatarUrl)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc])

  const showImage = Boolean(imageSrc) && !imageFailed

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden", roundedClassName, ringClassName, className)}
      role={showImage ? undefined : "img"}
      aria-label={showImage ? undefined : alt || tAria("profileImageUnset")}
    >
      {showImage ? (
        <Image
          src={imageSrc!}
          alt={alt}
          fill
          className="object-cover"
          unoptimized={unoptimized || imageSrc!.startsWith("blob:")}
          sizes={sizes}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-neutral-800">
          <User
            className={cn(
              "size-[46%] min-h-3 min-w-3 max-h-12 max-w-12 shrink-0 text-slate-400 dark:text-neutral-500",
              iconClassName,
            )}
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
