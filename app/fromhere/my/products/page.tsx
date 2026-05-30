import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { fetchMyProducts } from "@/fromhere/_my-products-data"
import { MyProductsPageClient } from "@/fromhere/my/products/MyProductsPageClient"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/**
 * 自分のプロダクト管理ページ。
 *
 * - 認証必須。未ログインなら sign-in へ、プロフィール未作成なら onboarding へ誘導する。
 *   サーバー側で redirect することで、未ログインユーザーが管理 UI を一瞬でも目にしないようにする。
 * - 個人ページなので robots: noindex。
 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.myProducts.metaTitle")
  return {
    title,
    robots: { index: false, follow: false },
    alternates: { canonical: "/fromhere/my/products" },
  }
}

export default async function Page() {
  const data = await fetchMyProducts()

  if (!data.viewer.isAuthenticated) {
    redirect("/fromhere/signin?next=%2Ffromhere%2Fmy%2Fproducts")
  }
  if (!data.viewer.hasProfile) {
    redirect("/fromhere/onboarding")
  }

  return <MyProductsPageClient data={data} />
}
