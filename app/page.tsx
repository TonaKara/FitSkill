import type { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { TalkLandingPage } from "@/talk/_landing"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { resolveGritvibPostAuthPath } from "@/lib/talk/post-auth-redirect"
import {
  GRITVIB_LANDING_DESCRIPTION,
  GRITVIB_LANDING_OG_IMAGE_PATH,
  GRITVIB_LANDING_OG_IMAGE_SIZE,
  GRITVIB_LANDING_TITLE_ABSOLUTE,
  getSiteUrl,
} from "@/lib/site-seo"

/**
 * GritVib (人間チャットサービス) の公開トップ (`/`)。
 *
 * 旧 GritVib スキルマーケットプレイスのトップは `/store` に退避済み。
 * このルートはサブスク型「人と話す」サービスのランディングに専有させる。
 */

export const dynamic = "force-dynamic"

const siteBase = getSiteUrl().replace(/\/$/, "")

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title =
    lookupMessage(dict, "metadata.gritvibHomeTitle") || GRITVIB_LANDING_TITLE_ABSOLUTE
  const description =
    lookupMessage(dict, "metadata.gritvibHomeDescription") || GRITVIB_LANDING_DESCRIPTION
  const homeOgImage = {
    url: `${siteBase}${GRITVIB_LANDING_OG_IMAGE_PATH}`,
    width: GRITVIB_LANDING_OG_IMAGE_SIZE.width,
    height: GRITVIB_LANDING_OG_IMAGE_SIZE.height,
    alt: title,
  } as const

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      url: `${siteBase}/`,
      title,
      description,
      images: [homeOgImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [homeOgImage.url],
    },
  }
}

/**
 * 「はじめる」の遷移先:
 *   - 未ログイン → 新規登録
 *   - ログイン済み + 会員レコードあり → チャット（管理者は管理画面）
 *   - ログイン済み + 会員レコードなし → オンボード (ニックネーム登録)
 */
export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )

  let startHref = "/talk/register"
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = Boolean(user)
  if (user) {
    startHref = await resolveGritvibPostAuthPath(supabase, user.id)
  }

  return <TalkLandingPage startHref={startHref} isLoggedIn={isLoggedIn} />
}
