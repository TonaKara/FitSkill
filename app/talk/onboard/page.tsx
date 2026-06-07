import type { Metadata } from "next"
import { OnboardPage } from "@/talk/_onboard"
import { talkPageMetadata } from "@/lib/talk/page-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return talkPageMetadata("onboard", "/talk/onboard")
}

export default function Page() {
  return <OnboardPage />
}
