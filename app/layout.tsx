import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono, Zen_Maru_Gothic } from "next/font/google";
import { ConsoleGuard } from "@/components/ConsoleGuard";
import { AccessibilityModeSync } from "@/components/AccessibilityModeSync";
import { AppShellLayout } from "@/components/layout/AppShellLayout";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { ConditionalSiteHeader } from "@/components/layout/ConditionalSiteHeader";
import { MobileHeaderMenuProvider } from "@/components/mobile-header-menu-context";
import { DiscoverSearchProvider } from "@/lib/discover-search-context";
import { HeaderAuthProvider } from "@/lib/header-auth-context";
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries";
import { pickLocaleFromAcceptLanguage } from "@/lib/i18n/detect-locale";
import {
  LOCALE_COOKIE_NAME,
  localeToHtmlLang,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { localeToOgLocale } from "@/lib/i18n/server-detect";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { ThemeProvider } from "@/components/theme-provider";
import {
  getCanonicalSiteUrl,
  getLocalizedSiteKeywords,
  LAYOUT_DESCRIPTION,
  LAYOUT_TITLE_DEFAULT,
} from "@/lib/site-seo";
import "./globals.css";

async function resolveInitialLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (fromCookie) {
    return normalizeLocale(fromCookie);
  }
  const headerStore = await headers();
  return pickLocaleFromAcceptLanguage(headerStore.get("accept-language"));
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 「編集部セレクト」など、楽しげで柔らかな印象を出したい見出し用の丸ゴシック。
 * 筑紫A丸ゴシック / キルゴに近い雰囲気を持つ Google Fonts の Zen Maru Gothic。
 * 日本語グリフは Google Fonts 側で subsetting されないため `preload: false` で警告を抑止。
 * `--font-zen-maru` を CSS 変数として公開し、Tailwind の任意値で適用する想定。
 */
const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru",
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const siteUrl = getCanonicalSiteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveInitialLocale();
  const dict = getDictionary(locale);
  const defaultTitle = lookupMessage(dict, "metadata.layoutTitleDefault") || LAYOUT_TITLE_DEFAULT;
  const description = lookupMessage(dict, "metadata.layoutDescription") || LAYOUT_DESCRIPTION;
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: "%s | GritVib",
    },
    description,
    applicationName: "GritVib",
    keywords: [...getLocalizedSiteKeywords(locale)],
    authors: [{ name: "GritVib", url: siteUrl }],
    creator: "GritVib",
    publisher: "GritVib",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: "website",
      locale: localeToOgLocale(locale),
      siteName: "GritVib",
      url: siteUrl,
      description,
    },
    twitter: {
      card: "summary_large_image",
      description,
    },
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await resolveInitialLocale();
  return (
    <html
      lang={localeToHtmlLang(initialLocale)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${zenMaruGothic.variable} h-[100svh] min-h-[100svh] antialiased md:h-full md:min-h-full`}
    >
      <body className="flex h-[100svh] min-h-[100svh] flex-col overflow-hidden md:h-full md:min-h-full md:overflow-visible">
        <LocaleProvider initialLocale={initialLocale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            storageKey="theme"
            disableTransitionOnChange={false}
          >
            <DiscoverSearchProvider>
              <HeaderAuthProvider>
                <MobileHeaderMenuProvider>
                  <AccessibilityModeSync />
                  <ConsoleGuard />
                  <div className="flex h-[100svh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-auto md:min-h-full md:overflow-visible">
                    <MaintenanceGuard>
                      <main className="relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto [overscroll-behavior-x:none]">
                        <div className="flex min-h-full min-w-0 flex-col overflow-x-hidden">
                          <ConditionalSiteHeader />
                          <AppShellLayout>
                            <div className="min-w-0 flex-1">{children}</div>
                          </AppShellLayout>
                          <ConditionalFooter />
                        </div>
                      </main>
                    </MaintenanceGuard>
                  </div>
                </MobileHeaderMenuProvider>
              </HeaderAuthProvider>
            </DiscoverSearchProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
