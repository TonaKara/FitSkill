import type { Metadata } from "next"
import { OnboardPage } from "@/talk/_onboard"

export const metadata: Metadata = {
  title: { absolute: "ニックネームを決める | GritVib" },
  alternates: { canonical: "/talk/onboard" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <OnboardPage />
}
