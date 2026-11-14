"use client";

import { useEffect, useRef, useState } from "react";
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

/** Google's sign-in client ID. Set, Google's own button signs in on this page, so Google names SPUZL's site. */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Gis = {
  accounts: {
    id: {
      initialize(o: Record<string, unknown>): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
};

let gisLoad: Promise<Gis> | null = null;
/** Google Identity Services, loaded once and only where a Google button shows. */
function loadGis(): Promise<Gis> {
  gisLoad ??= new Promise<Gis>((resolve, reject) => {
    const w = window as unknown as { google?: Gis };
    if (w.google?.accounts?.id) return resolve(w.google);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google?.accounts?.id ? resolve(w.google) : reject(new Error("gis")));
    s.onerror = () => reject(new Error("gis"));
    document.head.appendChild(s);
  }).catch((e) => {
    gisLoad = null;
    throw e;
  });
  return gisLoad;
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * "Continue with Google".
 * - With NEXT_PUBLIC_GOOGLE_CLIENT_ID set (owner, 13 Nov 2026): Google's own button. Google's window then names this
 *   site, not the sign-in server's address, and the player never leaves the page. Its ID token signs in (or, for a
 *   guest, links Google to the same account) with a one-time nonce; /api/v1/auth/finish then does what the OAuth
 *   return does. If Google's script can't load, the redirect button below is used instead.
 * - Otherwise: our button, styled to Google's guidelines, which goes to Google and back through /auth/callback.
 * `link` (guests) adds Google to this same account, so the user id and all progress stay ("Allow manual linking" on).
 */
export function GoogleButton({ next, link = false }: { next: string; link?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gis, setGis] = useState<"loading" | "ready" | "off">(CLIENT_ID && hasSupabase() ? "loading" : "off");
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID || !hasSupabase()) return;
    let live = true;
    const raw = crypto.randomUUID() + crypto.randomUUID();
    const giveUp = setTimeout(() => live && setGis((g) => (g === "loading" ? "off" : g)), 5000);
    (async () => {
      try {
        const [g, hashed] = await Promise.all([loadGis(), sha256Hex(raw)]);
        if (!live || !slot.current) return;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          ux_mode: "popup",
          itp_support: true,
          callback: async ({ credential }: { credential: string }) => {
            setBusy(true);
            setErr(null);
            const auth = supabaseBrowser().auth;
            const creds = { provider: "google" as const, token: credential, nonce: raw };
            const { error } = link ? await auth.linkIdentity(creds) : await auth.signInWithIdToken(creds);
            if (error) {
              setBusy(false);
              return setErr(T.googleFailed);
            }
            const done: { shield?: boolean } = await fetch("/api/v1/auth/finish", { method: "POST" })
              .then((r) => (r.ok ? r.json() : {}))
              .catch(() => ({}));
            const dest = new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/settings", window.location.origin);
            dest.searchParams.set("auth", "linked");
            if (done.shield) dest.searchParams.set("shield", "1");
            window.location.assign(dest.toString());
          },
        });
        const light = document.documentElement.dataset.theme === "light";
        g.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: light ? "outline" : "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          logo_alignment: "center",
          width: Math.min(400, Math.max(200, Math.round(slot.current.getBoundingClientRect().width) - 16)),
        });
        setGis("ready");
      } catch {
        if (live) setGis("off");
      }
    })();
    return () => {
      live = false;
      clearTimeout(giveUp);
    };
  }, [link, next]);

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
      {gis !== "off" && (
        <div
          ref={slot}
          aria-busy={gis === "loading" || busy}
          // Google's button lives in its own frame: `color-scheme: light` stops the browser painting that frame white on
          // a dark page, and the 56 px tile around it matches the buttons beside it (Google caps its own at 44 px).
          className={`flex h-14 w-full items-center justify-center overflow-hidden rounded-[16px] border ${busy ? "pointer-events-none opacity-70" : ""}`}
          style={{ colorScheme: "light", background: "var(--google-bg)", borderColor: "var(--google-line)" }}
        />
      )}
      {gis === "off" && (
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
      )}
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
