"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { api } from "@/lib/client/api";
import { copy } from "@/lib/copy";
import { guestCopy } from "@/lib/copy/guest";

const T = copy.signIn;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const RESEND_SECONDS = 30;

/**
 * Email + 6-digit code sign-in (no passwords, no links). Step 1 asks for the email and sends a code; step 2
 * takes the code and signs in. `onDone(hasProfile)` reports whether this account already has a SPUZL
 * profile, so a returning player goes straight to the Grid and a new one continues onboarding.
 *
 * `link` (guests only): instead of signing in, attach the email to the current anonymous account with
 * `updateUser` (the same linking path as Settings, Account), then confirm it with the emailed code
 * (`email_change`). The user id stays, so all progress is kept; the account is then marked as no longer a guest.
 */
export function EmailCodeSignIn({
  onDone,
  autoFocus = true,
  link = false,
}: {
  onDone: (hasProfile: boolean) => void;
  autoFocus?: boolean;
  link?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validEmail || busy) return;
    setBusy(true);
    setErr(null);
    const to = email.trim().toLowerCase();
    if (link) {
      // Link: the confirmation email (code, or a link back to this page) adds the email to this same account.
      const { data, error } = await supabaseBrowser().auth.updateUser(
        { email: to },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}` },
      );
      if (error) {
        setBusy(false);
        setErr(
          /rate|seconds|many/i.test(error.message)
            ? T.tooMany
            : /already|registered|exists/i.test(error.message)
              ? guestCopy.linkTaken
              : guestCopy.linkFailed,
        );
        return;
      }
      // Projects without email confirmation apply the change at once: nothing to type, the account is saved.
      if (data.user?.email?.toLowerCase() === to) return linked();
      setBusy(false);
      setSentTo(to);
      setCode("");
      setWait(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 250);
      return;
    }
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: to,
      // The email shows a 6-digit code; on projects whose template still sends a link, the link lands here
      // and the welcome screen carries on (returning players go home, new ones finish onboarding).
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });
    setBusy(false);
    if (error) {
      setErr(/rate|seconds|many/i.test(error.message) ? T.tooMany : T.sendFailed);
      return;
    }
    setSentTo(to);
    setCode("");
    setWait(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 250);
  };

  /** Same user id, now with an email: refresh the token (no longer anonymous) and mark the player as saved. */
  const linked = async () => {
    await supabaseBrowser()
      .auth.refreshSession()
      .catch(() => null);
    await api("/api/v1/account/sync", { method: "POST" }).catch(() => {});
    setBusy(false);
    onDone(true);
  };

  const verify = async (token: string) => {
    if (!sentTo || token.length !== 6 || busy) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: sentTo, token, type: link ? "email_change" : "email" });
    if (error) {
      setBusy(false);
      setCode("");
      setErr(T.badCode);
      codeRef.current?.focus();
      return;
    }
    if (link) return linked();
    const me = await api<{ id: string } | null>("/api/v1/me?optional=1").catch(() => null);
    onDone(!!me);
  };

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait" initial={false}>
        {!sentTo ? (
          <motion.form
            key="email"
            onSubmit={send}
            className="flex flex-col gap-3"
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            <label htmlFor="signin-email" className="text-[15px] font-semibold">
              {T.emailLabel}
            </label>
            <input
              id="signin-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus={autoFocus}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={T.emailPlaceholder}
              className="bg-surface-raised focus:ring-accent h-14 rounded-[16px] px-4 text-[17px] outline-none focus:ring-2"
            />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!validEmail}>
              {busy ? T.sending : T.sendCode}
            </Button>
            <p className="text-muted text-[14px]">{T.emailHelp}</p>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(code);
            }}
            className="flex flex-col gap-3"
            initial={{ opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            <p className="text-[15px] leading-snug">
              {T.sentTo} <b className="font-semibold break-all">{sentTo}</b>.
            </p>
            <p className="text-muted -mt-1 text-[14px]">{T.codeOrLink}</p>
            <label htmlFor="signin-code" className="sr-only">
              {T.codeLabel}
            </label>
            <input
              id="signin-code"
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) void verify(v);
              }}
              placeholder="••••••"
              className="num bg-surface-raised focus:ring-accent h-16 rounded-[16px] px-4 text-center text-[30px] font-semibold tracking-[0.5em] outline-none focus:ring-2"
            />
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>
              {busy ? T.signingIn : T.signIn}
            </Button>
            <div className="flex items-center justify-between text-[14px]">
              <button
                type="button"
                className="text-muted min-h-11 font-semibold"
                onClick={() => {
                  setSentTo(null);
                  setErr(null);
                }}
              >
                {T.otherEmail}
              </button>
              <button
                type="button"
                className="text-accent min-h-11 font-semibold disabled:opacity-50"
                disabled={wait > 0 || busy}
                onClick={() => void send()}
              >
                {wait > 0 ? T.resendIn(wait) : T.resend}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {err && (
        <p role="alert" className="text-danger flex items-center gap-2 text-[14px]">
          <Icon name="warning" size={16} />
          {err}
        </p>
      )}
    </div>
  );
}
