import type { Metadata, Viewport } from "next";
import { Unbounded, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/shell/Providers";
import { settingsBootScript } from "@/lib/settings/store";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["700", "800", "900"], display: "swap" });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://spuzl.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SPUZL · 51 games, one Grid", template: "%s · SPUZL" },
  description: "Puzzles, skill games and classic board games across 9 worlds. Play anytime, duel your friends, keep your streak alive.",
  applicationName: "SPUZL",
  manifest: "/manifest.webmanifest",
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
