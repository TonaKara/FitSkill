import type { Metadata } from "next"
import { RegisterPage } from "@/talk/_register"

export const metadata: Metadata = {
  title: { absolute: "はじめる | GritVib" },
  alternates: { canonical: "/talk/register" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <RegisterPage />
}
