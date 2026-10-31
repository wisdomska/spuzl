import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Fair play", description: "How SPUZL keeps boards honest and the game kind." };

// Copy for owner review before launch.
export default function FairPlay() {
  return (
    <>
      <h1>Fair play</h1>
      <p className="lede">SPUZL is free, and nobody can pay to win. Here is how we keep the boards honest and the game friendly.</p>

      <h2>Every clear is checked</h2>
      <ul>
        <li>Puzzle answers stay on our servers until you clear. Your board is checked there before any XP, Sparks or rank is given.</li>
        <li>Each game has a fastest humanly possible time. Clears faster than that are flagged and kept off the boards until a moderator looks.</li>
        <li>We keep your moves for 90 days, so top and flagged results can be checked step by step.</li>
        <li>You get one ranked try at each Daily. Replays are practice and never rank.</li>
      </ul>

      <h2>No paid advantages</h2>
      <ul>
        <li>Sparks are earned by playing. They can&apos;t be bought, sold or swapped for money.</li>
        <li>Sparks only buy looks for Spuz, board themes, Streak Freezes and practice hints. Nothing in the Shop helps a ranked Daily.</li>
        <li>There are no loot boxes and no gambling of any kind.</li>
      </ul>

      <h2>Friendly by design</h2>
      <ul>
        <li>There is no chat. Friends react with presets only: fire, laugh, GG, wow and clap.</li>
        <li>Nicknames are filtered. If one gets through, report it and a moderator checks within a day.</li>
        <li>You can block anyone. Blocked players can&apos;t find you, add you or see your activity.</li>
        <li>Players under 16 add friends only by invite link or QR code, and their city never appears on public boards.</li>
      </ul>

      <h2>What gets you removed</h2>
      <ul>
        <li>Using bots, scripts or tools that solve puzzles for you.</li>
        <li>Sharing answers to today&apos;s Daily before reset.</li>
        <li>Offensive nicknames or crew names, or using reports to harass people.</li>
        <li>Making extra accounts to climb boards or leagues.</li>
      </ul>
      <p>
        Depending on what happened, we may hide a result, reset a nickname, remove ranking access or close an account. If you think we got it
        wrong, <Link href="/contact">tell us</Link>.
      </p>

      <h2>Look after yourself</h2>
      <p>
        Puzzles are better with breaks. A Streak Freeze means one missed day is fine, and Relaxed mode hides the timer if racing the clock stops
        being fun.
      </p>
    </>
  );
}
