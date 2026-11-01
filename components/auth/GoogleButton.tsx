"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { hasSupabase } from "@/lib/supabase/env";
import { copy } from "@/lib/copy";

const T = copy.signIn;

/**
 * Google's standard "G" mark, unmodified (Sign in with Google branding guidelines: the four official colours,
 * never recoloured, on a white or dark neutral button).
 */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google", styled to Google's button guidelines (neutral fill, official mark, Google's wording).
 * - `link` (guests): adds Google to this same account with `linkIdentity`, so the user id and all progress stay.
 *   Needs "Allow manual linking" on in Supabase Auth.
 * - otherwise: signs in (or signs up) with Google.
 * Either way Google returns to /auth/callback, which sets the session and sends the player on to `next`.
 */
export function GoogleButton({ next, link = false }: { next: string; link?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    if (busy) return;
    setErr(null);
    if (!hasSupabase()) return setErr(T.googleFailed);
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const auth = supabaseBrowser().auth;
    const { error } = link
      ? await auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : await auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    // On success the browser is already leaving for Google; only failures come back here.
    if (error) {
      setBusy(false);
      setErr(T.googleFailed);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        aria-busy={busy}
        className="press flex h-14 w-full items-center justify-center gap-3 rounded-[16px] border text-[17px] font-semibold disabled:opacity-70"
        style={{ background: "var(--google-bg)", color: "var(--google-text)", borderColor: "var(--google-line)" }}
      >
        <GoogleG />
        {busy ? T.googleOpening : T.google}
      </button>
      {err && (
        <p role="alert" className="text-danger text-[14px]">
          {err}
        </p>
      )}
    </div>
  );
}

/** A quiet "or" rule between Google and email. */
export function OrRule() {
  return (
    <div className="text-muted flex items-center gap-3 text-[13px] font-semibold" aria-hidden="true">
      <span className="bg-line h-px flex-1" />
      {T.or}
      <span className="bg-line h-px flex-1" />
    </div>
  );
}
