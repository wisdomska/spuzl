import type { Metadata } from "next";
import Link from "next/link";
import { seoMeta } from "@/lib/copy/seo";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({ path: "/fair-play", ...seoMeta.fairPlay });

// Copy for owner review before launch.
export default function FairPlay() {
  return (
    <>
      <h1>Fair play</h1>
      <p className="lede">SPUZL is free, and nobody can pay to win. Here&apos;s how we keep it fair and friendly.</p>

      <h2>Every clear is checked</h2>
      <ul>
        <li>Answers stay on our servers. Your board is checked there before any XP, Sparks or rank.</li>
        <li>Clears faster than humanly possible are flagged and kept off the boards until a moderator looks.</li>
        <li>We keep your moves for 90 days, so top and flagged results can be checked step by step.</li>
      </ul>

      <h2>No paid advantages</h2>
      <ul>
        <li>Sparks are earned by playing. They can&apos;t be bought, sold or swapped for money.</li>
        <li>Sparks buy looks, board themes, Streak Freezes and practice hints. Nothing in the Shop helps you win.</li>
        <li>No loot boxes. No gambling of any kind.</li>
      </ul>

      <h2>Friendly by design</h2>
      <ul>
        <li>
          In-game chat is quick phrases and reactions. Typing is only on when everyone in the room is 16 or older, and typed lines are
          filtered; if anyone under 16 is in the room, everyone uses quick phrases.
        </li>
        <li>Nicknames are filtered. If one gets through, report it and a moderator checks within a day.</li>
        <li>You can block anyone. Blocked players can&apos;t find you, add you or see your activity.</li>
        <li>Players under 16 add friends only by invite link or QR code, and their city never appears on public boards.</li>
      </ul>

      <h2>What gets you removed</h2>
      <ul>
        <li>Using bots, scripts or tools that solve puzzles for you.</li>
        <li>Offensive nicknames or crew names, or using reports to harass people.</li>
        <li>Making extra accounts to climb boards or leagues.</li>
      </ul>
      <p>
        We may hide a result, reset a nickname, remove ranking access or close an account. Think we got it wrong?{" "}
        <Link href="/contact">Tell us</Link>.
      </p>

      <h2>Look after yourself</h2>
      <p>Puzzles are better with breaks. A Streak Freeze covers a missed day, and Relaxed mode hides the timer.</p>
    </>
  );
}
