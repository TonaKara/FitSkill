import type { Metadata } from "next"
import { RegisterPage } from "@/talk/_register"
import { talkPageMetadata } from "@/lib/talk/page-metadata"

export async function generateMetadata(): Promise<Metadata> {
  return talkPageMetadata("register", "/talk/register")
}

export default function Page() {
  return <RegisterPage />
}
