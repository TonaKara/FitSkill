import type { Metadata } from "next"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

type TalkMetaKey =
  | "login"
  | "register"
  | "chat"
  | "checkout"
  | "onboard"
  | "changePassword"

export async function talkPageMetadata(
  key: TalkMetaKey,
  canonical: string,
): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, `talk.meta.${key}`)
  return {
    title: { absolute: title },
    alternates: { canonical },
    robots: { index: false, follow: false },
  }
}
