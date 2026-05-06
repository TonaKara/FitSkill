import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsoleGuard } from "@/components/ConsoleGuard";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { ThemeProvider } from "@/components/theme-provider";
import {
  getSiteUrl,
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

const siteUrl = getSiteUrl();

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
  /** 子ルートごとに url / title を誤結合しないよう、サイト共通フィールドのみ。 */
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
  /**
   * - `/favicon.svg` … `public/favicon.svg`（ベクター・ブランドマーク）
   * - `/favicon.ico` … 互換用（`public` / `app`）
   * - `/apple-touch-icon.png` … `public/apple-touch-icon.png`
   * metadata の相対パスは metadataBase（getSiteUrl）起点で絶対 URL 化
   */
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ConsoleGuard />
          <div className="flex min-h-full flex-col">
            <MaintenanceGuard>
              <div className="flex-1">{children}</div>
            </MaintenanceGuard>
            <ConditionalFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
