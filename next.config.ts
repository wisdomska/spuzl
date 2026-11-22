import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Google's sign-in button opens a pop-up that must report back to this page; plain same-origin cut it off (the pop-up
  // stayed blank on accounts.google.com/gsi/transform). Pop-ups we open keep their link; other sites still can't.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Server source maps were 77 MB of every deployment's ~140 MB of server output (Vercel deployment storage, owner
  // 14 Nov 2026). Nothing reads them: Sentry isn't set up to upload maps. Browser maps were already off.
  productionBrowserSourceMaps: false,
  experimental: {
    serverSourceMaps: false,
    // Turbopack's file-system cache (on by default since 16.3) served a stale app/globals.css: a CSS-only change through
    // the Tailwind loader was not rebuilt, locally and on Vercel (1.72.0 shipped the previous turned-page rotation,
    // 22 Nov 2026). Off for builds and dev, so every build is the source as it is; a build takes a few seconds longer.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be revalidated so fixes reach players on their next visit.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
