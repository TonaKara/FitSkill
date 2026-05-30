import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetailPageClient } from "@/fromhere/p/[slug]/ProductDetailPageClient"
import { fetchProductDetail, normalizeProductSlug } from "@/fromhere/_product-detail-data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale, localeToOgLocale } from "@/lib/i18n/server-detect"

/** 動的データに依存するため、毎リクエストで取得する */
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = normalizeProductSlug(rawSlug)
  if (!slug) {
    return { title: "FromHere" }
  }
  const data = await fetchProductDetail(slug)
  if (!data) {
    return { title: "FromHere" }
  }
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const titleTemplate = lookupMessage(dict, "fromhere.detail.metaTitle")
  const descriptionTemplate = lookupMessage(dict, "fromhere.detail.metaDescription")
  const title = titleTemplate.replace("{title}", data.product.title)
  const description = descriptionTemplate.replace("{tagline}", data.product.tagline)
  const canonical = `/fromhere/p/${data.product.slug}`
  /**
   * OGP 画像はプロダクトのアプリアイコンを使う。
   * `app_icon_path` が未登録のプロダクトは、og:image を出さず親セグメントの
   * fallback ロジック（プラットフォーム側のキャッシュ／デフォルト）に任せる。
   */
  const iconImage =
    typeof data.product.appIconUrl === "string" && data.product.appIconUrl.trim().length > 0
      ? data.product.appIconUrl.trim()
      : null
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title,
      description,
      type: "website",
      locale: localeToOgLocale(locale),
      siteName: "FromHere",
      images: iconImage ? [{ url: iconImage }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: iconImage ? [iconImage] : undefined,
    },
    /** 下書きは検索インデックスから除外する */
    robots: data.product.status === "draft" ? { index: false, follow: false } : undefined,
  }
}

export default async function Page({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = normalizeProductSlug(rawSlug)
  if (!slug) {
    notFound()
  }
  const data = await fetchProductDetail(slug)
  if (!data) {
    notFound()
  }
  return <ProductDetailPageClient data={data} />
}
