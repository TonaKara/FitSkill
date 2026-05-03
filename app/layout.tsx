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

const SITE_DESCRIPTION =
  "GritVib（グリットヴィブ）は、パーソナルトレーニングやフィットネス指導などのスキルを出品・購入できるマーケットプレイス。相談から始められる安心の取引で、運動をもっと身近に。"

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
  metadataBase: new URL("https://gritvib.com"),
  title: {
    default: "GritVib — フィットネススキルのマーケットプレイス",
    template: "%s | GritVib",
  },
  description: SITE_DESCRIPTION,
  applicationName: "GritVib",
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: "GritVib", url: "https://gritvib.com" }],
  creator: "GritVib",
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
    title: "GritVib — フィットネススキルのマーケットプレイス",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "GritVib — フィットネススキルのマーケットプレイス",
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
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
