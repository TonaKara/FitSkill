import { permanentRedirect } from "next/navigation"

type LegacyProfileRedirectProps = {
  params: Promise<{ user_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LegacyProfileRedirect({ params, searchParams }: LegacyProfileRedirectProps) {
  const { user_id } = await params
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const entry of value) {
        qs.append(key, entry)
      }
    } else {
      qs.set(key, value)
    }
  }
  const query = qs.toString()
  const segment = encodeURIComponent(user_id.trim())
  permanentRedirect(`/store/${segment}${query ? `?${query}` : ""}`)
}
