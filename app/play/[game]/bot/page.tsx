import type { Metadata } from "next";
import { openGameNow } from "@/lib/game-settings/server";
import { notFound } from "next/navigation";
import { isBotGame, isBotLevel } from "@/lib/bot";
import { BotScreen } from "@/components/play/BotScreen";
import { requirePlayerPage } from "@/lib/auth/gate";
import { boardGames } from "@/lib/copy/board-games";

export async function generateMetadata({ params }: PageProps<"/play/[game]/bot">): Promise<Metadata> {
  const { game } = await params;
  const meta = await openGameNow(game);
  return meta?.botPlay ? { title: `${meta.name}: ${boardGames.bot.entry}` } : {};
}

/**
 * /play/<game>/bot?level=easy|medium|hard: a casual full game against the bot for games with
 * `botPlay` in the catalogue. Runs on the device; no attempt, no XP, nothing ranked.
 */
export default async function BotPlay({ params, searchParams }: PageProps<"/play/[game]/bot">) {
  const { game } = await params;
  const { level } = await searchParams;
  // Unknown and retired games, games Off, and games In testing unless an admin is signed in are not found.
  const meta = await openGameNow(game);
  if (!meta?.botPlay || !isBotGame(game)) notFound();
  // Same first-run gate as every Play page (intro, then onboarding).
  await requirePlayerPage();
  return <BotScreen meta={meta} game={game} initialLevel={isBotLevel(level) ? level : "medium"} />;
}
