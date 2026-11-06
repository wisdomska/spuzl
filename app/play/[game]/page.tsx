import type { Metadata } from "next";
import { getGameSettings } from "@/lib/game-settings/server";
import { notFound, redirect } from "next/navigation";
import { playableGame } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { PlayScreen } from "@/components/play/PlayScreen";
import { requireSessionPage } from "@/lib/auth/gate";
import { isLadderGame } from "@/lib/game/levels";

export async function generateMetadata({ params }: PageProps<"/play/[game]">): Promise<Metadata> {
  const { game } = await params;
  const meta = playableGame(game);
  return meta ? { title: meta.name, description: meta.rule } : {};
}

/**
 * /play/<game>?mode=daily|free|archive|level|five&date=YYYY-MM-DD&difficulty=easy|medium|hard|expert|mega (free play)
 * &level=<n> (Levels; without it the server picks the player's next level). mode=five plays the game as part of
 * today's Daily Five (R2-05), its own switch whether or not Dailies are on.
 */
export default async function Play({ params, searchParams }: PageProps<"/play/[game]">) {
  const { game } = await params;
  const sp = await searchParams;
  const meta = playableGame(game);
  if (!meta || !hasLogic(game)) notFound();
  if (meta.lab && !(await getGameSettings())["features.newGames"]) notFound();
  // SPZ-01: only the session is checked here (a local JWT check). The player profile is already in the client
  // cache from the previous screen, and PlayScreen sends players without a profile to onboarding itself.
  await requireSessionPage();
  // Dailies off (admin "features.dailies"): every link plays free; old Daily and archive links land there too.
  const settings = await getGameSettings();
  const dailies = settings["features.dailies"];
  // Levels work whether or not Dailies are on, and so does the Daily Five (its own switch; the server checks the
  // game is in today's five).
  const mode =
    sp.mode === "level" && isLadderGame(game)
      ? "level"
      : sp.mode === "five" && settings["dailyFive.enabled"]
        ? "five"
        : !dailies
          ? "free"
          : sp.mode === "free" || sp.mode === "archive"
            ? sp.mode
            : "daily";
  // Ludo free play is a full game against the bot (owner's call); the Daily stays the best-move puzzle.
  if (game === "ludo" && mode === "free") redirect("/play/ludo/bot");
  const level = mode === "level" && typeof sp.level === "string" && /^\d{1,4}$/.test(sp.level) ? Number(sp.level) || undefined : undefined;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const difficulty =
    typeof sp.difficulty === "string" && ["easy", "medium", "hard", "expert", "mega"].includes(sp.difficulty)
      ? (sp.difficulty as "easy" | "medium" | "hard" | "expert" | "mega")
      : undefined;
  return <PlayScreen meta={meta} initialMode={mode} date={date} difficulty={difficulty} level={level} />;
}
