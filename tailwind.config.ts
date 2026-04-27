import type { Config } from "tailwindcss"

/**
 * Tailwind v4 では実際の色値は `app/globals.css` の CSS 変数（:root / .dark）と
 * `@theme inline` がソースです。ここでは v0 / IDE 向けにパスと、ユーティリティが参照する
 * セマンティック名を var(--color-*) で明示します（globals と二重定義にならないよう値は書かない）。
 *
 * ブランド（理想画像寄せ）:
 * - Primary / Ring / Sidebar primary: 落ち着いた赤 #C62828
 * - ダーク背景: ほぼ #000、サーフェス: 約 #1A1A1A
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
      },
      colors: {
        red: {
          50: "#fbe9e9",
          100: "#f6d4d4",
          200: "#edaaaa",
          300: "#e47f7f",
          400: "#db5555",
          500: "#d23a3a",
          600: "#c62828",
          700: "#a32121",
          800: "#7f1919",
          900: "#5c1212",
          950: "#330909",
        },
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: {
          DEFAULT: "var(--color-card)",
          foreground: "var(--color-card-foreground)",
        },
        popover: {
          DEFAULT: "var(--color-popover)",
          foreground: "var(--color-popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          foreground: "var(--color-destructive-foreground)",
        },
        border: "var(--color-border)",
        input: "var(--color-input)",
        ring: "var(--color-ring)",
        chart: {
          1: "var(--color-chart-1)",
          2: "var(--color-chart-2)",
          3: "var(--color-chart-3)",
          4: "var(--color-chart-4)",
          5: "var(--color-chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--color-sidebar)",
          foreground: "var(--color-sidebar-foreground)",
          primary: "var(--color-sidebar-primary)",
          "primary-foreground": "var(--color-sidebar-primary-foreground)",
          accent: "var(--color-sidebar-accent)",
          "accent-foreground": "var(--color-sidebar-accent-foreground)",
          border: "var(--color-sidebar-border)",
          ring: "var(--color-sidebar-ring)",
        },
      },
    },
  },
  plugins: [],
}

export default config
