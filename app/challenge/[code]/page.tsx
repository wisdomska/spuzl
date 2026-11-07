import type { Metadata } from "next";
import { ChallengeScreen } from "@/components/multiplayer/ChallengeScreen";
import { challengeCopy as T } from "@/lib/copy/challenge";
import { CHALLENGE_SIZES, challengeCodeOf, challengePath } from "@/lib/share/challenge-card";
import { loadChallengeCard } from "@/lib/share/challenge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Link preview metadata (WhatsApp, Instagram and X read og:title, og:description and og:image; Next.js renders
 * metadata in the head for those bots). Built from the challenge row like the card itself; an unknown, expired
 * or switched-off challenge gets the plain title and the site's own card.
 */
export async function generateMetadata({ params }: PageProps<"/challenge/[code]">): Promise<Metadata> {
  const { code: raw } = await params;
  const code = challengeCodeOf(raw);
  const card = code && hasSupabase() ? await loadChallengeCard(supabaseAdmin(), code).catch(() => null) : null;
  if (!code || !card) return { title: T.meta.fallbackTitle, description: T.meta.fallbackDescription, robots: { index: false } };
  const title = T.meta.title(card.nickname, card.kicker, card.big);
  const description = T.meta.description(card.nickname);
  const image = { url: `/api/og/challenge/${code}`, ...CHALLENGE_SIZES.og, alt: card.alt };
  return {
    title,
    description,
    robots: { index: false },
    alternates: { canonical: challengePath(code) },
    openGraph: { type: "website", siteName: "SPUZL", title, description, url: `/challenge/${code}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Async challenge: card, same puzzle with the sender's ghost timer, head-to-head result (Overlays A1, A2). */
export default async function Page({ params }: PageProps<"/challenge/[code]">) {
  const { code } = await params;
  return <ChallengeScreen code={code} />;
}
