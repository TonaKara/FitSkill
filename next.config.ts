import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wjfkumhrbvokfatdjfhc.supabase.co",
      },
    ],
  },
  async rewrites() {
    return [
      /** 誤って /api/og/skills/:id（複数形）を開いた場合も同一ハンドラへ */
      { source: "/api/og/skills/:id", destination: "/api/og/skill/:id" },
    ]
  },
};

export default nextConfig;
