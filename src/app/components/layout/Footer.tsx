"use client"

import Link from "next/link"
import { SiInstagram, SiNote, SiX } from "@icons-pack/react-simple-icons"
import { useTranslations } from "@/lib/i18n/useI18n"

const baseLinkClass =
  "text-sm text-zinc-300 transition-colors hover:text-white"

export function Footer() {
  const t = useTranslations("footer")
  return (
    <footer className="border-t border-zinc-800 bg-black text-zinc-100">
      {/* スマホ: 固定ボトムナビ（h-16 + safe-area）と重ならないよう下余白を確保。PC は従来どおり py-12 */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-[calc(3rem+4rem+env(safe-area-inset-bottom,0px))] md:px-8 md:py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-white">{t("aboutTitle")}</h2>
            <nav className="flex flex-col gap-2">
              <Link href="/about" className={baseLinkClass}>
                {t("about")}
              </Link>
              <Link href="/about/logo" className={baseLinkClass}>
                {t("brandLogo")}
              </Link>
              <Link href="/legal/terms" className={baseLinkClass}>
                {t("terms")}
              </Link>
              <Link href="/legal/privacy-policy" className={baseLinkClass}>
                {t("privacy")}
              </Link>
              <Link href="/legal/specified-commercial-transactions" className={baseLinkClass}>
                {t("commercial")}
              </Link>
            </nav>
          </section>

          <div className="space-y-10">
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-white">{t("helpTitle")}</h2>
              <nav className="flex flex-col gap-2">
                <Link href="/guide" className={baseLinkClass}>
                  {t("guide")}
                </Link>
                <Link href="/contact" className={baseLinkClass}>
                  {t("contact")}
                </Link>
                <Link href="/japan-entry" prefetch={false} className={baseLinkClass}>
                  {t("japanEntry")}
                </Link>
              </nav>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold text-white">{t("boardTitle")}</h2>
              <nav className="flex flex-col gap-2">
                <Link href="/fromhere" className={baseLinkClass}>
                  {t("fromhere")}
                </Link>
                <Link href="/fromhere/reviews" className={baseLinkClass}>
                  {t("fromhereReviews")}
                </Link>
              </nav>
            </section>
          </div>

          <section className="flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white">{t("socialTitle")}</h2>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/gritvib_PR"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("officialX")}
                  className="text-zinc-200 transition-opacity hover:opacity-75"
                >
                  <SiX className="h-6 w-6 fill-current" />
                </a>
                <a
                  href="https://www.instagram.com/gritvib_jp"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("officialInstagram")}
                  className="text-zinc-200 transition-opacity hover:opacity-75"
                >
                  <SiInstagram className="h-6 w-6 fill-current" />
                </a>
                <a
                  href="https://note.com/gritvib"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("officialNote")}
                  className="text-zinc-200 transition-opacity hover:opacity-75"
                >
                  <SiNote className="h-6 w-6 fill-current" />
                </a>
              </div>
            </div>
            <p className="text-sm text-zinc-400">{t("copyright")}</p>
          </section>
        </div>
      </div>
    </footer>
  )
}
