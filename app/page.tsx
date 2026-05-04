import type { Metadata } from "next"
import HomePage from "@/page"
import { HOME_DESCRIPTION, HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE_ABSOLUTE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: HOME_TITLE_ABSOLUTE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    title: HOME_TITLE_ABSOLUTE,
    description: HOME_DESCRIPTION,
  },
}

export default function Page() {
  return <HomePage />
}
