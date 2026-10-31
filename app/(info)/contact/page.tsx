import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact", description: "Get help with SPUZL, report a problem or ask about your data." };

// OWNER REVIEW: set NEXT_PUBLIC_SUPPORT_EMAIL to the real support inbox before launch.
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function Contact() {
  return (
    <>
      <h1>Contact</h1>
      <p className="lede">We read everything. Here is the fastest way to reach us for each kind of problem.</p>

      <h2>Someone is being unkind or cheating</h2>
      <p>
        Open their profile or tap the three dots on their activity, then Report. Pick a reason and, if you like, block them in the same
        step. A moderator checks every report within a day.
      </p>

      <h2>A puzzle looks broken</h2>
      <p>Tell us the game and the date{EMAIL ? " by email" : ""}. If a Daily is broken we can swap it for a fixed one.</p>

      <h2>Your data or account</h2>
      <p>
        You can download or delete everything yourself in <Link href="/settings#account">Settings, Account</Link>. Parents and teachers who
        need a young player&apos;s account removed can write to us.
      </p>

      <h2>Email</h2>
      {EMAIL ? (
        <p>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      ) : (
        <p>Our support inbox opens at launch. Until then, please use Report in the app.</p>
      )}
    </>
  );
}
