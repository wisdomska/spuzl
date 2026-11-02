import type { Metadata } from "next";
import { getGameSettings } from "@/lib/game-settings/server";
import { notFound } from "next/navigation";
import { GAME_BY_ID } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { PlayScreen } from "@/components/play/PlayScreen";
import { requireSessionPage } from "@/lib/auth/gate";
import { isLadderGame } from "@/lib/game/levels";

export async function generateMetadata({ params }: PageProps<"/play/[game]">): Promise<Metadata> {
  const { game } = await params;
  const meta = GAME_BY_ID[game];
  return meta ? { title: meta.name, description: meta.rule } : {};
}

/**
 * /play/<game>?mode=daily|free|archive|level&date=YYYY-MM-DD&difficulty=easy|medium|hard|expert|mega (free play)
 * &level=<n> (Levels; without it the server picks the player's next level).
 */
export default async function Play({ params, searchParams }: PageProps<"/play/[game]">) {
  const { game } = await params;
  const sp = await searchParams;
  const meta = GAME_BY_ID[game];
  if (!meta || !hasLogic(game)) notFound();
  if (meta.lab && !(await getGameSettings())["features.newGames"]) notFound();
  // SPZ-01: only the session is checked here (a local JWT check). The player profile is already in the client
  // cache from the previous screen, and PlayScreen sends players without a profile to onboarding itself.
  await requireSessionPage();
  // Dailies off (admin "features.dailies"): every link plays free; old Daily and archive links land there too.
  const dailies = (await getGameSettings())["features.dailies"];
  // Levels work whether or not Dailies are on.
  const mode =
    sp.mode === "level" && isLadderGame(game)
      ? "level"
      : !dailies
        ? "free"
        : sp.mode === "free" || sp.mode === "archive"
          ? sp.mode
          : "daily";
  const level = mode === "level" && typeof sp.level === "string" && /^\d{1,4}$/.test(sp.level) ? Number(sp.level) || undefined : undefined;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const difficulty =
    typeof sp.difficulty === "string" && ["easy", "medium", "hard", "expert", "mega"].includes(sp.difficulty)
      ? (sp.difficulty as "easy" | "medium" | "hard" | "expert" | "mega")
      : undefined;
  return <PlayScreen meta={meta} initialMode={mode} date={date} difficulty={difficulty} level={level} />;
}
