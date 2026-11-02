import type { Metadata, Viewport } from "next";
import { Unbounded, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/shell/Providers";
import { settingsBootScript } from "@/lib/settings/store";
import { siteCopy } from "@/lib/copy/site";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["700", "800", "900"], display: "swap" });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteCopy.title, template: "%s · SPUZL" },
  description: siteCopy.description,
  applicationName: "SPUZL",
  manifest: "/manifest.webmanifest",
  // Plain files in /public (not generated routes), so hosts like the Vercel dashboard can find the site icon.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SPUZL" },
  openGraph: { type: "website", siteName: "SPUZL", url: siteUrl },
  twitter: { card: "summary_large_image" },
  // Google Search Console ownership tag (HTML tag method, property https://spuzl.vercel.app). The value is public;
  // GOOGLE_SITE_VERIFICATION overrides it.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || "Eow3-ie9l2JvR0oiP6C0Zzov7YY0EzdcInunXCYJYRc" },
};

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
