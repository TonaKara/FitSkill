import type { Metadata } from "next"
import AccountSectionPage from "@/account/[section]/page"
import { formatMessage, getDictionary, lookupMessage, lookupMessageOrUndefined } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

type PageProps = {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const sectionTitle = lookupMessageOrUndefined(dict, `metadata.account.sections.${section}`)
  const fallbackTitle = lookupMessage(dict, "metadata.account.fallbackTitle")
  const title = sectionTitle ?? fallbackTitle
  const description = formatMessage(
    lookupMessage(dict, "metadata.account.descriptionTemplate"),
    { title },
  )
  return {
    title,
    description,
    alternates: { canonical: `/account/${section}` },
    openGraph: { url: `/account/${section}` },
    robots: { index: false, follow: false },
  }
}

export default function Page(props: PageProps) {
  return <AccountSectionPage {...props} />
}
