import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsoleGuard } from "@/components/ConsoleGuard";
import { AccessibilityModeSync } from "@/components/AccessibilityModeSync";
import { BottomNav } from "@/components/bottom-nav";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MobilePullToRefreshMain } from "@/components/mobile-pull-to-refresh-main";
import { MobileHeaderMenuProvider } from "@/components/mobile-header-menu-context";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { ThemeProvider } from "@/components/theme-provider";
import {
  getCanonicalSiteUrl,
  LAYOUT_DESCRIPTION,
  LAYOUT_TITLE_DEFAULT,
  SITE_KEYWORDS,
} from "@/lib/site-seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getCanonicalSiteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: LAYOUT_TITLE_DEFAULT,
    template: "%s | GritVib",
  },
  description: LAYOUT_DESCRIPTION,
  alternates: {
    canonical: siteUrl,
  },
  applicationName: "GritVib",
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "GritVib", url: siteUrl }],
  creator: "GritVib",
  publisher: "GritVib",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Keep only site-level Open Graph fields in root metadata.
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "GritVib",
    url: siteUrl,
    description: LAYOUT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    description: LAYOUT_DESCRIPTION,
  },
  // Shared icon metadata（ヘッダー左上と同じオレンジ角丸タイル＋白マーク＋黒3本線。`npm run generate:brand-assets` で生成）
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-[100svh] min-h-[100svh] antialiased md:h-full md:min-h-full`}
    >
      <body className="flex h-[100svh] min-h-[100svh] flex-col overflow-hidden md:h-full md:min-h-full md:overflow-visible">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="theme"
          disableTransitionOnChange={false}
        >
          <MobileHeaderMenuProvider>
            <AccessibilityModeSync />
            <ConsoleGuard />
            <div className="flex h-[100svh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-auto md:min-h-full md:overflow-visible">
              <MaintenanceGuard>
                <MobilePullToRefreshMain>
                  <div className="flex min-h-full min-w-0 flex-col">
                    <div className="min-w-0 flex-1">{children}</div>
                    <ConditionalFooter />
                  </div>
                </MobilePullToRefreshMain>
              </MaintenanceGuard>
              <BottomNav />
            </div>
          </MobileHeaderMenuProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
