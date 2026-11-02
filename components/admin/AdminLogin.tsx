"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, HttpError } from "@/lib/client/api";
import { adminSupabase } from "@/lib/client/admin-auth";
import { adminCopy } from "@/lib/copy/admin";
import { Btn, Field, Notice, inputCls } from "./ui";

type Step = "loading" | "password" | "set-password" | "verify" | "denied";

const C = adminCopy.login;
const SENT_KEY = "spuzl.admin.codeSentAt";
const REASONS: Record<string, string> = C.reasons;

/**
 * Admin sign-in: email and password, then a 6-digit code emailed to the admin (no authenticator app). The server
 * marks this sign-in session verified for 12 hours. A password-reset link lands here too and asks for a new password
 * first.
 */
export function AdminLogin({ next, reason }: { next: string; reason: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(reason && reason !== "aal2_required" ? (REASONS[reason] ?? null) : null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const pendingPassword = useRef<string | null>(null);

  const finish = useCallback(async () => {
    try {
      await api("/api/admin/me");
      router.replace(next);
      router.refresh();
    } catch (e) {
      if (e instanceof HttpError && e.code === "not_admin") setStep("denied");
      else setError(C.cannotOpen);
    }
  }, [next, router]);

  /** Ask the server to email a code to this admin. */
  const sendCode = useCallback(async (force = false) => {
    // A reload within a minute of the last code reuses it (Supabase sends one email a minute per address).
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(SENT_KEY)) || 0;
    } catch {
      /* storage blocked */
    }
    if (!force && Date.now() - last < 60_000) return setSentAt(last);
    try {
      await api("/api/admin/login/code", { method: "POST" });
      const now = Date.now();
      setSentAt(now);
      try {
        sessionStorage.setItem(SENT_KEY, String(now));
      } catch {
        /* storage blocked */
      }
    } catch (e) {
      if (e instanceof HttpError && e.code === "not_admin") return setStep("denied");
      setError(e instanceof HttpError && e.code === "too_many" ? C.tooMany : C.codeNotSent);
    }
  }, []);

  /** After a password step: straight in if this session already passed the code step, else email a code. */
  const route = useCallback(async () => {
    try {
      await api("/api/admin/me");
      router.replace(next);
      router.refresh();
    } catch (e) {
      if (e instanceof HttpError && e.code === "not_admin") return setStep("denied");
      if (e instanceof HttpError && e.code === "aal2_required") {
        setStep("verify");
        return sendCode();
      }
      setStep("password");
    }
  }, [next, router, sendCode]);

  useEffect(() => {
    const sb = adminSupabase();
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
        const { error: e } = await sb.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        });
        history.replaceState(null, "", window.location.pathname + window.location.search);
        if (e) {
          setError(C.resetExpired);
          return setStep("password");
        }
        return setStep("set-password");
      }
      if (hash.get("error_description")) setError(hash.get("error_description"));
      const { data } = await sb.auth.getSession();
      if (data.session && !data.session.user.is_anonymous) return route();
      setStep("password");
    })();
  }, [route]);

  const signIn = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setBusy(true);
    setError(null);
    const { error: e } = await adminSupabase().auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (e) return setError(e.status === 429 ? C.tooMany : C.wrongPassword);
    await route();
  };

  const setPassword = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const pw = String(f.get("password"));
    if (pw.length < 12) return setError(C.tooShort);
    if (pw !== String(f.get("confirm"))) return setError(C.mismatch);
    setBusy(true);
    setError(null);
    const { error: e } = await adminSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (e) {
      if (/aal/i.test(e.code ?? e.message)) {
        // An old authenticator on the account blocks the change until the code step removes it.
        pendingPassword.current = pw;
        setStep("verify");
        return sendCode();
      }
      return setError(e.message);
    }
    await route();
  };

  const verify = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const code = String(new FormData(ev.currentTarget).get("code")).replace(/\s/g, "");
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login/verify", { json: { code } });
    } catch (e) {
      setBusy(false);
      if (e instanceof HttpError && e.code === "not_admin") return setStep("denied");
      return setError(C.badCode);
    }
    if (pendingPassword.current) {
      const { error: e } = await adminSupabase().auth.updateUser({ password: pendingPassword.current });
      pendingPassword.current = null;
      if (e) {
        setBusy(false);
        return setError(e.message);
      }
    }
    await finish();
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--admin-canvas)] px-4 py-10">
      <div className="bg-surface w-full max-w-[400px] rounded-[16px] p-6 shadow-[0_0_0_1px_var(--line)]">
        <div className="font-display flex items-end pb-5 text-[22px] leading-[0.9] font-black tracking-[-0.05em]">
          <span>SPU</span>
          <span className="text-accent">Z</span>
          <span>L</span>
          <span className="num text-muted ml-2 text-[12px] font-semibold tracking-normal">{adminCopy.shell.badge}</span>
        </div>
        {error && (
          <div className="pb-4">
            <Notice tone="danger" icon="warning">
              {error}
            </Notice>
          </div>
        )}
        {step === "loading" && <div className="h-40" aria-busy="true" />}

        {step === "password" && (
          <form onSubmit={signIn} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">{C.signIn}</h1>
            <Field label={C.email} htmlFor="email">
              <input id="email" name="email" type="email" autoComplete="username" required className={`${inputCls} w-full`} />
            </Field>
            <Field label={C.password} htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`${inputCls} w-full`}
              />
            </Field>
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="mt-1 w-full">
              {C.continue}
            </Btn>
            <p className="text-muted text-[13px] leading-[1.4]">{C.signInNote}</p>
          </form>
        )}

        {step === "set-password" && (
          <form onSubmit={setPassword} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">{C.choosePassword}</h1>
            <Field label={C.newPassword} htmlFor="password" hint={C.newPasswordHint}>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                className={`${inputCls} w-full`}
              />
            </Field>
            <Field label={C.repeat} htmlFor="confirm">
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                className={`${inputCls} w-full`}
              />
            </Field>
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="mt-1 w-full">
              {C.savePassword}
            </Btn>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verify} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">{C.codeTitle}</h1>
            <p className="text-muted text-[14px] leading-[1.4]">{C.codeIntro}</p>
            <CodeInput />
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="w-full">
              {C.verify}
            </Btn>
            <ResendButton sentAt={sentAt} onResend={() => sendCode(true)} />
          </form>
        )}

        {step === "denied" && (
          <div className="flex flex-col gap-3.5">
            <Notice tone="warn" icon="lock-simple">
              {C.reasons.not_admin}
            </Notice>
            <Btn
              size="lg"
              onClick={async () => {
                await adminSupabase().auth.signOut();
                setError(null);
                setStep("password");
              }}
            >
              {C.another}
            </Btn>
          </div>
        )}
      </div>
    </main>
  );
}

/** "Send a new code", available 30 s after the last one (Supabase allows one email a minute per address). */
function ResendButton({ sentAt, onResend }: { sentAt: number; onResend: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const wait = Math.max(0, Math.ceil((sentAt + 60_000 - now) / 1000));
  return (
    <button type="button" onClick={onResend} disabled={wait > 0} className="text-accent text-[14px] font-semibold disabled:opacity-50">
      {wait > 0 ? C.resendIn(wait) : C.resend}
    </button>
  );
}

function CodeInput() {
  return (
    <Field label={C.code} htmlFor="code">
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        className={`${inputCls} num w-full text-center text-[20px] tracking-[0.3em]`}
      />
    </Field>
  );
}
