import type { Metadata } from "next";
import { getGameSettings, openGameNow } from "@/lib/game-settings/server";
import { notFound, redirect } from "next/navigation";
import { hasLogic } from "@/games/logic-registry";
import { PlayScreen } from "@/components/play/PlayScreen";
import { requireSessionPage } from "@/lib/auth/gate";
import { gameReturn } from "@/lib/onboarding-return";
import { isLadderGame } from "@/lib/game/levels";
import { loadGamesMeta, withCopy } from "@/lib/games-meta/server";

export async function generateMetadata({ params }: PageProps<"/play/[game]">): Promise<Metadata> {
  const { game } = await params;
  const meta = await openGameNow(game);
  // R4-10: the admin's rule (Library page) when it overrides the catalog's (cached 30 s per instance).
  return meta ? { title: meta.name, description: withCopy(meta, await loadGamesMeta()).rule } : {};
}

/**
 * /play/<game>?mode=daily|free|archive|level|five&date=YYYY-MM-DD&difficulty=easy|medium|hard|expert|mega (free play)
 * &level=<n> (Levels; without it the server picks the player's next level). mode=five plays the game as part of
 * today's Daily Five (R2-05), its own switch whether or not Dailies are on.
 */
export default async function Play({ params, searchParams }: PageProps<"/play/[game]">) {
  const { game } = await params;
  const sp = await searchParams;
  // Unknown, retired and switched-off lab games ("features.labGames") are not found.
  const meta = await openGameNow(game);
  if (!meta || !hasLogic(game)) notFound();
  // SPZ-01: only the session is checked here (a local JWT check). The player profile is already in the client
  // cache from the previous screen, and PlayScreen sends players without a profile to onboarding itself.
  // R4-03: a signed-out visitor (e.g. Play on /games/<id>) comes back to this game after onboarding.
  await requireSessionPage({ back: gameReturn(game) });
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
