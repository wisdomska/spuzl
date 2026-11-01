"use client";

import { useGameSettings } from "@/lib/game-settings/client";
import { useSettings } from "@/lib/settings/store";
import { isRaceGame } from "@/lib/multiplayer/games";
import { worldCopy } from "@/lib/copy/world";
import Link from "next/link";
import { motion } from "motion/react";
import { WORLD_BY_ID, gamesInWorld, labGamesInWorld, type WorldId } from "@/lib/catalog";
import { useMe, useToday } from "@/lib/client/api";
import { Island } from "@/components/home/Island";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { GameIcon3D } from "./GameIcon3D";
import { BotEntry } from "./BotEntry";
import { ChallengeEntry } from "@/components/multiplayer/GameChallenge";
import { PLAY_NAV } from "@/lib/analytics/play-nav";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

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

  return (
    <main
      className="bg-bg mx-auto min-h-dvh max-w-[560px]"
      style={{ ["--world" as string]: world.color, ["--world-ink" as string]: world.ink }}
    >
      <header
        className="dotgrid relative overflow-hidden pb-5"
        style={{ backgroundColor: `color-mix(in srgb, ${world.color} 14%, var(--bg))` }}
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
      <ul className="flex flex-col gap-2.5 px-4 pt-4 pb-10">
        {games.map((g, i) => {
          const s = status(g.id);
          const done = isDone(g.id);
          const timeMs = dailiesOn ? (s?.timeMs ?? me.data?.today.cleared[g.id]) : undefined;
          const inProgress = dailiesOn && s?.state === "in_progress";
          const canChallenge = isRaceGame(g.id) && !relaxed;
          const hasActions = !!g.botPlay || canChallenge;
          return (
            <motion.li
              key={g.id}
              initial={{ opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.24, delay: i * 0.04, ease: EASE_OUT }}
              // One card per game: the game itself, then its ways to play with others in a footer inside the same card.
              className="bg-surface overflow-hidden rounded-[20px]"
              style={{ boxShadow: inProgress ? "inset 0 0 0 2px var(--world)" : undefined }}
            >
              <Link
                href={done || !dailiesOn ? `/play/${g.id}?mode=free` : `/play/${g.id}`}
                className="press flex items-center gap-3.5 p-3"
                {...PLAY_NAV}
              >
                <GameIcon3D meta={g} size={64} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display text-[18px] font-extrabold">{g.name}</span>
                  <span className="text-muted text-[14px] leading-[1.35]">{g.blurb}</span>
                </span>
                {done ? (
                  <Chip icon="check-circle" bg="var(--success-tint)" fg="var(--accent)" num={timeMs !== undefined}>
                    {timeMs !== undefined ? formatClock(timeMs) : dailiesOn ? worldCopy.done : worldCopy.played}
                  </Chip>
                ) : inProgress ? (
                  <Chip icon="hourglass-medium" bg="var(--surface-raised)" fg="var(--text)">
                    {worldCopy.resume}
                  </Chip>
                ) : (
                  <Chip icon="sparkle" bg="var(--world)" fg="#0E0F1A">
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
                  <ChallengeEntry meta={g} inline />
                  <BotEntry meta={g} inline />
                </div>
              )}
            </motion.li>
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
