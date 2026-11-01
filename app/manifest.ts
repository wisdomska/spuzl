import type { MetadataRoute } from "next";

/** Web app manifest (served at /manifest.webmanifest, already linked from the root layout metadata). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SPUZL",
    short_name: "SPUZL",
    description: "Puzzles, skill games and classic board games across 9 worlds. Play anytime, duel your friends, keep your streak alive.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0E0F1A",
    theme_color: "#0E0F1A",
    categories: ["games", "education", "entertainment"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "All games",
        short_name: "Games",
        url: "/library?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
