import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms", description: "The rules for using SPUZL." };

// OWNER LEGAL REVIEW REQUIRED before launch: governing law, liability wording and the operator's legal name are placeholders
// in plain language, not legal advice.
export default function Terms() {
  return (
    <>
      <h1>Terms</h1>
      <p className="lede">Last updated 31 October 2026. By playing SPUZL you agree to these terms. They are short on purpose.</p>

      <h2>Who can play</h2>
      <p>You must be 13 or older. If you are under the age of adulthood where you live, check with a parent or guardian first.</p>

      <h2>SPUZL is free</h2>
      <ul>
        <li>Playing costs nothing. There is nothing to buy with money today.</li>
        <li>
          Sparks, XP, badges and cosmetics are part of the game. They have no cash value and can&apos;t be sold, traded or transferred. We
          may change prices or rewards to keep the game balanced.
        </li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You can play as a guest. A guest account lives on one device until you sign in with Google or email.</li>
        <li>Keep your sign-in to yourself. One person per account, one account per person.</li>
        <li>
          You can download or delete your account at any time in <Link href="/settings#account">Settings</Link>.
        </li>
      </ul>

      <h2>Play fair, be kind</h2>
      <p>
        Follow the <Link href="/fair-play">fair play rules</Link>. No cheating tools, no extra accounts for ranking, no offensive names, no
        harassment. We may hide results, reset names, remove ranking access or close accounts that break them.
      </p>

      <h2>Our content</h2>
      <p>
        The games, puzzles, art, Spuz, sounds and text are ours or used with permission. You may share results and share cards the app
        makes. Please don&apos;t copy or republish our puzzles.
      </p>

      <h2>Service</h2>
      <p>
        We work hard to keep SPUZL running and fair, but it is provided as it is. Puzzles can be fixed or swapped if one is broken, and
        features may change or end. To the extent the law allows, we aren&apos;t responsible for losses from using SPUZL, such as a lost
        streak during an outage.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If these terms change, we&apos;ll update this page and tell you in the app. These terms are governed by the laws of Ghana. Questions
        go to the <Link href="/contact">contact page</Link>.
      </p>
    </>
  );
}
