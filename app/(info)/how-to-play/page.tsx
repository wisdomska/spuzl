import type { Metadata } from "next";
import Link from "next/link";
import { WORLDS, gamesInWorld, type GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "How to play", description: "The rules of all 51 SPUZL games, the Daily, Free play, streaks and leagues." };

const CONTROLS: Record<GameMeta["engine"], string> = {
  grid: "Tap a cell to cycle its marks, drag to mark several. Keyboard: arrows move, Space cycles, Enter confirms.",
  word: "Tap letters or type on your keyboard. Backspace removes the last letter.",
  phaser: "Use the on-screen buttons, the arrow keys or a gamepad.",
  board: "Tap a piece, then tap where it goes. Legal moves light up.",
  custom: "Follow the buttons on screen. Everything also works with a keyboard.",
};

const SCORING: Record<GameMeta["scoring"], string> = {
  time: "Fastest clear wins. Fewer hints, then fewer mistakes, break ties.",
  score: "Highest score wins. Time breaks ties.",
  deaths: "Fewest deaths wins, then time.",
};

// Copy for owner review before launch.
export default function HowToPlay() {
  return (
    <>
      <h1>How to play</h1>
      <p className="lede">51 games in 9 worlds. Every game is playable any time, as often as you like.</p>

      <h2>The basics</h2>
      <ul>
        <li>
          <strong>The Daily.</strong> Each game has one Daily a day, the same puzzle for everyone. It resets at 00:00 GMT. You get one ranked try,
          and it counts for your streak, leaderboards and Full Spuzl.
        </li>
        <li>
          <strong>Free play.</strong> Fresh puzzles that never run out. Each clear earns 10 XP and 5 Sparks, up to 300 XP a day. Free play never
          touches streaks or boards.
        </li>
        <li>
          <strong>Difficulty.</strong> Dailies get harder through the week: Monday easy, Tuesday to Thursday medium, Friday hard, Saturday expert,
          Sunday the Weekly Mega.
        </li>
        <li>
          <strong>Hints.</strong> Up to 3 per puzzle. Each one shows a single safe next step. A clear with hints earns half the XP.
        </li>
        <li>
          <strong>Streaks.</strong> Clear at least one Daily a day to keep your streak. A Streak Freeze covers one missed day. You can hold 2.
        </li>
        <li>
          <strong>Leagues.</strong> Every Monday you join a league of 30. XP you earn in the week is your score. The top 7 move up, the bottom 5
          move down.
        </li>
        <li>
          <strong>Relaxed mode.</strong> Turn it on in <Link href="/settings">Settings</Link> to hide timers while you play. Your time still shows on
          the results screen.
        </li>
      </ul>

      {WORLDS.map((w) => (
        <section key={w.id} aria-labelledby={`world-${w.id}`} className="flex flex-col gap-3">
          <h2 id={`world-${w.id}`} className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[10px]" style={{ background: w.color, color: "#0E0F1A" }} aria-hidden>
              <Icon name={w.icon} size={18} />
            </span>
            {w.name}
          </h2>
          {gamesInWorld(w.id).map((g) => (
            <article key={g.id} className="bg-surface flex flex-col gap-1.5 rounded-[18px] p-4">
              <h3 className="flex items-center gap-2">
                <Icon name={g.icon} size={18} />
                {g.name}
              </h3>
              <p>{g.rule}</p>
              <p className="text-muted text-[14px]">{CONTROLS[g.engine]}</p>
              <p className="text-muted text-[14px]">{SCORING[g.scoring]}</p>
              {g.photosensitive && (
                <p className="text-gold text-[14px]">Has fast flashing visuals, kept under 3 flashes a second. You&apos;ll see a notice before you start.</p>
              )}
              <Link href={`/play/${g.id}`} className="self-start text-[15px]">
                Play {g.name}
              </Link>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
