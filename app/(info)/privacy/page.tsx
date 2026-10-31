import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What SPUZL collects, why, how long we keep it, and how to export or delete it.",
};

// OWNER LEGAL REVIEW REQUIRED before launch (Ghana Act 843, Nigeria NDPA 2023, GDPR). Copy is plain-language and honest
// about what the code does today; it is not legal advice.
export default function Privacy() {
  return (
    <>
      <h1>Privacy</h1>
      <p className="lede">
        Last updated 31 October 2026. SPUZL is a free puzzle game for players aged 13 and up. We collect as little as we can.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Age band</strong> (13 to 15, 16 to 17, or 18 and up), never your birthday. It decides which safety rules apply to you.
        </li>
        <li>
          <strong>Nickname and Spuz look.</strong> These show on boards, leagues and your profile.
        </li>
        <li>
          <strong>Email</strong>, only if you choose to sign in with email or Google. We use it to sign you in and recover your account.
        </li>
        <li>
          <strong>City and country</strong>, only if you add them in Settings, for local boards. If you are under 16, your city never shows
          publicly.
        </li>
        <li>
          <strong>School</strong>, only if you join a class challenge with a teacher&apos;s code.
        </li>
        <li>
          <strong>Your games.</strong> Times, hints, mistakes and the moves you made, so we can check clears and rank Dailies fairly.
        </li>
        <li>
          <strong>Social activity.</strong> Friends, requests, blocks, reactions and reports you send.
        </li>
        <li>
          <strong>Anonymous usage stats</strong> about page loads and speed, which don&apos;t identify you.
        </li>
      </ul>

      <h2>What we never do</h2>
      <ul>
        <li>We don&apos;t sell your data or show ads, and there is no third-party ad tracking.</li>
        <li>We don&apos;t run open chat, so there are no private messages to store.</li>
        <li>We don&apos;t collect precise location, contacts, photos or your birthday.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your profile, results and progress: for as long as you have an account.</li>
        <li>Move-by-move logs: 90 days, unless a result was flagged for review.</li>
        <li>Anonymous usage stats: up to 12 months.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Hide your activity</strong> from friends in <Link href="/settings#privacy">Settings, Privacy</Link>.
        </li>
        <li>
          <strong>Download everything</strong> we hold about you as a file from <Link href="/settings#account">Settings, Account</Link>.
        </li>
        <li>
          <strong>Delete your account</strong> from the same place. It is removed straight away, with your results, friends and Sparks. It
          can&apos;t be undone.
        </li>
      </ul>

      <h2>Players under 16</h2>
      <p>
        Under-16 players appear on boards with nickname and avatar only. Friends can only be added with an invite link or QR code. If you
        are a parent or teacher and want a young player&apos;s account removed, <Link href="/contact">contact us</Link>. Players under 13
        can&apos;t use SPUZL.
      </p>

      <h2>Where your data lives</h2>
      <p>
        SPUZL runs on Supabase (database and sign-in) and Vercel (the app), both hosted in London, United Kingdom. They process data only to
        run SPUZL for us.
      </p>

      <h2>On your device</h2>
      <p>
        We store a sign-in cookie, your settings and today&apos;s puzzles on your device so the game works offline. Nothing here is used for
        advertising.
      </p>

      <h2>Changes</h2>
      <p>If we change how we use your data, we&apos;ll update this page and tell you in the app before it takes effect.</p>
      <p>
        Questions? <Link href="/contact">Get in touch</Link>.
      </p>
    </>
  );
}
