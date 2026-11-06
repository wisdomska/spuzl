"use client";

import { useGameSettings } from "@/lib/game-settings/client";
import { useSettings } from "@/lib/settings/store";
import { isRaceGame } from "@/lib/multiplayer/games";
import { worldCopy } from "@/lib/copy/world";
import Link from "next/link";
import { motion } from "motion/react";
import { WORLD_BY_ID, gamesInWorld, labGamesInWorld, type WorldId, UI_ACCENT } from "@/lib/catalog";
import { useMe, useToday } from "@/lib/client/api";
import { Island } from "@/components/home/Island";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { GameIcon3D } from "./GameIcon3D";
import { BotEntry } from "./BotEntry";
import { LiveEntries, hasLiveEntries } from "./LiveEntry";
import { LevelEntry } from "./LevelEntry";
import { isLadderGame } from "@/lib/game/levels";
import { useLevels } from "@/lib/client/levels";
import { ChallengeEntry } from "@/components/multiplayer/GameChallenge";
import { PLAY_NAV } from "@/lib/analytics/play-nav";
import { resumeNote, useResumeGames } from "@/lib/client/resume";

/** Solo Screens 03 World view: island header in world colour, then each game with today's status. */
export function WorldScreen({ id }: { id: WorldId }) {
  const world = WORLD_BY_ID[id];
  const labOn = useGameSettings()["features.newGames"];
  const games = [...gamesInWorld(id), ...(labOn ? labGamesInWorld(id) : [])];
  const me = useMe();
  const today = useToday();
  const status = (gid: string) => today.data?.games.find((g) => g.id === gid);
  const dailiesOn = useGameSettings()["features.dailies"];
  const played = new Set(me.data?.played ?? []);
  const isDone = (gid: string) =>
    dailiesOn ? status(gid)?.state === "cleared" || me.data?.today.cleared[gid] !== undefined : played.has(gid);
  const cleared = games.filter((g) => isDone(g.id)).length;
  const rating = me.data?.ratings[id];
  const relaxed = useSettings((x) => x.relaxed);
  const levels = useLevels(games.some((g) => isLadderGame(g.id)));
  // Solo puzzles left part way on this device (lib/client/resume.ts): their card says Resume.
  const resumeGames = useResumeGames();

  return (
    <main
      className="bg-bg mx-auto min-h-dvh max-w-[560px] lg:max-w-[1180px]"
      style={{ ["--world" as string]: UI_ACCENT, ["--world-ink" as string]: UI_ACCENT }}
    >
      <header
        className="dotgrid relative overflow-hidden pb-5"
        style={{ backgroundColor: `color-mix(in srgb, ${UI_ACCENT} 10%, var(--bg))` }}
      >
        {/* z-10: the scaled island below would otherwise sit on top of the button and swallow taps */}
        <div className="safe-top relative z-10 px-4">
          <Link
            href="/"
            aria-label="Back to the Grid"
            className="press bg-surface-raised flex size-11 items-center justify-center rounded-[14px]"
          >
            <Icon name="arrow-left" size={20} />
          </Link>
        </div>
        <motion.div
          className="pointer-events-none -mt-6 flex justify-center"
          initial={{ opacity: 0, transform: "scale(0.9)" }}
          animate={{ opacity: 1, transform: "scale(1.6)" }}
          transition={{ duration: 0.32, ease: [0.77, 0, 0.175, 1] }}
          style={{ height: 150, paddingTop: 30 }}
        >
          <Island color={world.color} icon={world.icon} />
        </motion.div>
        <div className="px-5">
          <h1
            className="font-display text-[32px] font-black [[data-theme=light]_&]:text-[var(--world-ink)]"
            style={{ color: "var(--world)" }}
          >
            {world.name}
          </h1>
          <p className="text-[15px] font-medium">
            {world.tagline}. {dailiesOn ? worldCopy.clearedToday(cleared, games.length) : worldCopy.tried(cleared, games.length)}
            {rating !== undefined && (
              <span className="text-muted">
                {" "}
                Rating <span className="num">{Math.round(rating)}</span>.
              </span>
            )}
          </p>
        </div>
      </header>
      <ul className="flex flex-col gap-2.5 px-4 pt-4 pb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:px-6 2xl:grid-cols-3">
        {games.map((g, i) => {
          const s = status(g.id);
          const done = isDone(g.id);
          const timeMs = dailiesOn ? (s?.timeMs ?? me.data?.today.cleared[g.id]) : undefined;
          // A free-play or level puzzle left part way leads (the card opens free play, which resumes it).
          const resume = resumeGames.has(g.id);
          const resumeLevel = resume && resumeNote(g.id)?.mode === "level";
          const inProgress = resume || (dailiesOn && s?.state === "in_progress");
          const canChallenge = isRaceGame(g.id) && !relaxed;
          const hasActions = !!g.botPlay || canChallenge || hasLiveEntries(g.id) || isLadderGame(g.id);
          return (
            // CSS stagger, not Motion: it plays while the route is still loading, and CSS keeps it off the main thread.
            // One card per game: the game itself, then its ways to play with others in a footer inside the same card.
            <li
              key={g.id}
              className="list-in bg-surface overflow-hidden rounded-[20px]"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, boxShadow: inProgress ? "inset 0 0 0 2px var(--world)" : undefined }}
            >
              <Link
                href={resumeLevel ? `/play/${g.id}?mode=level` : done || resume || !dailiesOn ? `/play/${g.id}?mode=free` : `/play/${g.id}`}
                className="press flex items-center gap-3.5 p-3"
                {...PLAY_NAV}
              >
                <GameIcon3D meta={g} size={64} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display text-[18px] font-extrabold">{g.name}</span>
                  <span className="text-muted text-[14px] leading-[1.35]">{g.blurb}</span>
                </span>
                {resume ? (
                  <Chip icon="hourglass-medium" bg="var(--surface-raised)" fg="var(--text)">
                    {worldCopy.resume}
                  </Chip>
                ) : done ? (
                  <Chip icon="check-circle" bg="var(--success-tint)" fg="var(--accent)" num={timeMs !== undefined}>
                    {timeMs !== undefined ? formatClock(timeMs) : dailiesOn ? worldCopy.done : worldCopy.played}
                  </Chip>
                ) : inProgress ? (
                  <Chip icon="hourglass-medium" bg="var(--surface-raised)" fg="var(--text)">
                    {worldCopy.resume}
                  </Chip>
                ) : (
                  <Chip icon="sparkle" bg="var(--world)" fg="var(--on-accent)">
                    {worldCopy.isNew}
                  </Chip>
                )}
              </Link>
              {hasActions && (
                <div
                  className="border-line flex flex-wrap items-center gap-2 border-t px-3 py-2.5"
                  role="group"
                  aria-label={worldCopy.withOthers(g.name)}
                >
                  <LevelEntry meta={g} progress={levels.data?.games[g.id]} />
                  <ChallengeEntry meta={g} inline />
                  <LiveEntries meta={g} />
                  <BotEntry meta={g} inline />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function Chip({ icon, bg, fg, num, children }: { icon: string; bg: string; fg: string; num?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 text-[14px] font-semibold ${num ? "num" : ""}`}
      style={{ background: bg, color: fg }}
    >
      <Icon name={icon} size={14} />
      {children}
    </span>
  );
}
