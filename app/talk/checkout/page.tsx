import type { Metadata } from "next"
import { CheckoutPage } from "@/talk/_checkout"
import { talkPageMetadata } from "@/lib/talk/page-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return talkPageMetadata("checkout", "/talk/checkout")
}

export default function Page() {
  return <CheckoutPage />
}
