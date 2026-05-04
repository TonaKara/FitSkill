import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsoleGuard } from "@/components/ConsoleGuard";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { ThemeProvider } from "@/components/theme-provider";
import {
  LAYOUT_DESCRIPTION,
  LAYOUT_TITLE_DEFAULT,
  SITE_KEYWORDS,
  SITE_URL,
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: LAYOUT_TITLE_DEFAULT,
    template: "%s | GritVib",
  },
  description: LAYOUT_DESCRIPTION,
  applicationName: "GritVib",
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "GritVib", url: SITE_URL }],
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
   * /favicon.ico は app/favicon.ico（ファイル規約）で配信。metadata で public と二重指定しない。
   * Apple タッチアイコンは public/apple-touch-icon.png（180×180）。
   */
  icons: {
    apple: "/apple-touch-icon.png",
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
