import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // خروجی standalone فقط برای اجرای SELF-HOST (سندباکس/سرور اختصاصی) —
  // در استقرار Vercel خروجی استاندارد Next.js استفاده می‌شود
  ...(process.env.VERCEL === "1" ? {} : { output: "standalone" as const }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
