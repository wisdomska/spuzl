import type { Metadata, Viewport } from "next";
import { Unbounded, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/shell/Providers";
import { settingsBootScript } from "@/lib/settings/store";
import { siteCopy } from "@/lib/copy/site";
import { SITE_URL } from "@/lib/seo/site";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["700", "800", "900"], display: "swap" });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: siteCopy.title, template: "%s · SPUZL" },
  description: siteCopy.description,
  applicationName: "SPUZL",
  manifest: "/manifest.webmanifest",
  // Plain files in /public (not generated routes), so hosts like the Vercel dashboard can find the site icon.
  icons: {
    // app/favicon.ico (the App Router file convention, which Vercel also reads for the project avatar) adds its own tag.
    icon: [{ url: "/icon.png", type: "image/png", sizes: "192x192" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SPUZL" },
  // No og:url here: each public page sets its own (lib/seo/site.ts publicMetadata), and a page without one must not
  // claim to be the home page. The image is app/opengraph-image.tsx unless a page has its own.
  openGraph: { type: "website", siteName: "SPUZL", locale: "en" },
  twitter: { card: "summary_large_image" },
  verification: siteVerification(),
};

/**
 * Search Console ownership tags. Google: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (or the older GOOGLE_SITE_VERIFICATION),
 * else the live property's public HTML tag (https://spuzl.vercel.app). Bing Webmaster Tools: msvalidate.01 from
 * NEXT_PUBLIC_BING_SITE_VERIFICATION, rendered only when set.
 */
function siteVerification(): Metadata["verification"] {
  const google =
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    process.env.GOOGLE_SITE_VERIFICATION ||
    "Eow3-ie9l2JvR0oiP6C0Zzov7YY0EzdcInunXCYJYRc";
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
  return { google, ...(bing ? { other: { "msvalidate.01": bing } } : {}) };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E0F1A" },
    { media: "(prefers-color-scheme: light)", color: "#F5F6FA" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${unbounded.variable} ${geist.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
