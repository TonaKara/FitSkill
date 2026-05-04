import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsoleGuard } from "@/components/ConsoleGuard";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** 本番の絶対 URL 解決用。http を混ぜない（metadata / OG / Twitter の href はすべてここ基準）。 */
const SITE_URL = "https://gritvib.com" as const

const SITE_TITLE_DEFAULT = "GritVib | スキルマーケットプレイス"

const SITE_DESCRIPTION =
  "フィットネスに特化したスキル売買のマーケットプレイス。パーソナルトレーニングやオンラインレッスンなどの指導スキルを出品・購入でき、相談から始められる安心の取引で運動をもっと身近に。"

const SITE_KEYWORDS = [
  "GritVib",
  "グリットヴィブ",
  "フィットネス",
  "パーソナルトレーニング",
  "スキルマーケット",
  "オンラインレッスン",
  "トレーニング指導",
  "スポーツ",
  "健康",
  "gritvib.com",
] as const

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: "%s | GritVib",
  },
  description: SITE_DESCRIPTION,
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
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "GritVib",
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
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
