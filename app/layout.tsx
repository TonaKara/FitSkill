import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: LAYOUT_TITLE_DEFAULT,
    template: "%s | GritVib",
  },
  description: LAYOUT_DESCRIPTION,
  applicationName: "GritVib",
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "GritVib", url: getSiteUrl() }],
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
  },
  twitter: {
    card: "summary_large_image",
  },
  /**
   * - `/favicon.ico` … `public/favicon.ico`（静的）と `app/favicon.ico`（規約）の両方を用意
   * - `/apple-touch-icon.png` … `public/apple-touch-icon.png`
   * metadata の相対パスは metadataBase 起点で絶対 URL 化される（プレビュー URL と一致させるため getSiteUrl を使用）
   */
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
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
