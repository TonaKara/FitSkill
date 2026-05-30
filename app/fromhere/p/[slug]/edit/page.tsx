import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { EditProductPageClient } from "@/fromhere/p/[slug]/edit/EditProductPageClient"
import { fetchFromHereProductForEdit } from "@/fromhere/_product-edit-data"
import { normalizeProductSlug } from "@/fromhere/_product-detail-data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/** 編集ページは動的かつ private なので毎リクエストで SSR */
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.productEdit.metaTitle")
  // 編集画面は noindex 固定（ログイン必須 + 編集権限ありユーザーのみアクセス可能）
  return {
    title,
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = normalizeProductSlug(rawSlug)
  if (!slug) {
    notFound()
  }
  const result = await fetchFromHereProductForEdit(slug)

  if (result.state === "unauthenticated") {
    redirect(`/fromhere/signin?next=${encodeURIComponent(`/fromhere/p/${slug}/edit`)}`)
  }
  if (result.state === "no-profile") {
    redirect("/fromhere/onboarding")
  }
  if (result.state === "not-found") {
    notFound()
  }
  if (result.state === "forbidden") {
    // 編集権限がない場合は商品詳細にリダイレクト（404 ではなく 302 で誘導）
    redirect(`/fromhere/p/${slug}`)
  }

  return <EditProductPageClient product={result.product} />
}
