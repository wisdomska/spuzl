"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, HttpError } from "@/lib/client/api";
import { adminSupabase } from "@/lib/client/admin-auth";
import { Btn, Field, Notice, inputCls } from "./ui";

type Step = "loading" | "password" | "set-password" | "enroll" | "verify" | "denied";

const REASONS: Record<string, string> = {
  not_admin: "This account has no admin role.",
  aal2_required: "Enter your authenticator code to continue.",
};

/**
 * Admin sign-in (SRS 15.1): email and password, then a TOTP second factor through Supabase MFA. First sign-in
 * enrols the authenticator. A password-reset link lands here too and asks for a new password first.
 */
export function AdminLogin({ next, reason }: { next: string; reason: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(reason && reason !== "aal2_required" ? (REASONS[reason] ?? null) : null);
  const [busy, setBusy] = useState(false);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const pendingPassword = useRef<string | null>(null);

  const finish = useCallback(
    async (justEnrolled: boolean) => {
      try {
        if (justEnrolled) await api("/api/admin/me", { method: "POST" });
        else await api("/api/admin/me");
        router.replace(next);
        router.refresh();
      } catch (e) {
        if (e instanceof HttpError && e.code === "not_admin") setStep("denied");
        else setError("Could not open the console. Try again.");
      }
    },
    [next, router],
  );

  /** After a password step: route to TOTP enrolment, TOTP verification, or straight in. */
  const route = useCallback(async () => {
    const sb = adminSupabase();
    const { data, error: e } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (e || !data) return setStep("password");
    if (data.currentLevel === "aal2") return finish(false);
    if (data.nextLevel === "aal2") return setStep("verify");
    setStep("enroll");
  }, [finish]);

  useEffect(() => {
    const sb = adminSupabase();
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.get("type") === "recovery" && hash.get("access_token") && hash.get("refresh_token")) {
        const { error: e } = await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        history.replaceState(null, "", window.location.pathname + window.location.search);
        if (e) {
          setError("This reset link has expired. Ask the owner for a new one.");
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

  // Enrolment: clear abandoned factors, then show the QR code and secret.
  useEffect(() => {
    if (step !== "enroll" || enroll) return;
    const sb = adminSupabase();
    (async () => {
      const { data: list } = await sb.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.factor_type === "totp" && f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `SPUZL admin ${new Date().toISOString().slice(0, 10)}` });
      if (e || !data) return setError("Could not start authenticator setup. Reload and try again.");
      setEnroll({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [step, enroll]);

  const signIn = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setBusy(true);
    setError(null);
    const { error: e } = await adminSupabase().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (e) return setError(e.status === 429 ? "Too many tries. Wait a minute and try again." : "Email or password is wrong.");
    await route();
  };

  const setPassword = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const pw = String(f.get("password"));
    if (pw.length < 12) return setError("Use at least 12 characters.");
    if (pw !== String(f.get("confirm"))) return setError("The passwords do not match.");
    setBusy(true);
    setError(null);
    const { error: e } = await adminSupabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (e) {
      if (/aal/i.test(e.code ?? e.message)) {
        pendingPassword.current = pw;
        return setStep("verify");
      }
      return setError(e.message);
    }
    await route();
  };

  const verify = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const code = String(new FormData(ev.currentTarget).get("code")).replace(/\s/g, "");
    const sb = adminSupabase();
    setBusy(true);
    setError(null);
    let factorId = enroll?.factorId;
    if (!factorId) {
      const { data } = await sb.auth.mfa.listFactors();
      factorId = data?.totp?.[0]?.id;
    }
    if (!factorId) {
      setBusy(false);
      return setStep("enroll");
    }
    const { error: e } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (e) {
      setBusy(false);
      return setError("That code did not match. Check your authenticator's time and try again.");
    }
    if (pendingPassword.current) {
      await sb.auth.updateUser({ password: pendingPassword.current });
      pendingPassword.current = null;
    }
    await finish(!!enroll);
    setBusy(false);
  };

  return (
    <main className="bg-[var(--admin-canvas)] flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="bg-surface w-full max-w-[400px] rounded-[16px] p-6 shadow-[0_0_0_1px_var(--line)]">
        <div className="flex items-end pb-5 font-display text-[22px] leading-[0.9] font-black tracking-[-0.05em]">
          <span>SPU</span>
          <span className="text-accent">Z</span>
          <span>L</span>
          <span className="num text-muted ml-2 text-[12px] font-semibold tracking-normal">admin</span>
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
            <h1 className="font-display text-[20px] font-extrabold">Sign in</h1>
            <Field label="Email" htmlFor="email">
              <input id="email" name="email" type="email" autoComplete="username" required className={inputCls} />
            </Field>
            <Field label="Password" htmlFor="password">
              <input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
            </Field>
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="mt-1 w-full">
              Continue
            </Btn>
            <p className="text-muted text-[13px] leading-[1.4]">Admin accounts are added by the owner. Your authenticator app is needed next.</p>
          </form>
        )}

        {step === "set-password" && (
          <form onSubmit={setPassword} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">Choose a password</h1>
            <Field label="New password" htmlFor="password" hint="At least 12 characters.">
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
            </Field>
            <Field label="Repeat it" htmlFor="confirm">
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className={inputCls} />
            </Field>
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="mt-1 w-full">
              Save password
            </Btn>
          </form>
        )}

        {step === "enroll" && (
          <form onSubmit={verify} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">Set up your authenticator</h1>
            <p className="text-muted text-[14px] leading-[1.4]">Scan this code with an authenticator app, then enter the 6 digit code it shows.</p>
            <div className="flex items-center justify-center rounded-[12px] bg-white p-3">
              {enroll ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={enroll.qr} alt="Authenticator QR code" width={180} height={180} />
              ) : (
                <div className="size-[180px]" />
              )}
            </div>
            {enroll && (
              <Field label="Or type this key">
                <code data-testid="totp-secret" className="num bg-bg rounded-[10px] px-3 py-2 text-[13px] break-all select-all">
                  {enroll.secret}
                </code>
              </Field>
            )}
            <CodeInput />
            <Btn type="submit" tone="primary" size="lg" disabled={busy || !enroll} className="w-full">
              Turn on and continue
            </Btn>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verify} className="flex flex-col gap-3.5">
            <h1 className="font-display text-[20px] font-extrabold">Authenticator code</h1>
            <p className="text-muted text-[14px] leading-[1.4]">Enter the 6 digit code from your authenticator app.</p>
            <CodeInput />
            <Btn type="submit" tone="primary" size="lg" disabled={busy} className="w-full">
              Verify
            </Btn>
          </form>
        )}

        {step === "denied" && (
          <div className="flex flex-col gap-3.5">
            <Notice tone="warn" icon="lock-simple">
              This account has no admin role.
            </Notice>
            <Btn
              size="lg"
              onClick={async () => {
                await adminSupabase().auth.signOut();
                setError(null);
                setStep("password");
              }}
            >
              Use another account
            </Btn>
          </div>
        )}
      </div>
    </main>
  );
}

function CodeInput() {
  return (
    <Field label="Code" htmlFor="code">
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        className={`${inputCls} num text-center text-[20px] tracking-[0.3em]`}
      />
    </Field>
  );
}
