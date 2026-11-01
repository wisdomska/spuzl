"use client";

import Link from "next/link";
import { Suspense, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, prefersReducedMotion, type Settings } from "@/lib/settings/store";
import { api, HttpError, useMe } from "@/lib/client/api";
import { EmailCodeSignIn } from "@/components/onboarding/EmailCodeSignIn";
import { copy } from "@/lib/copy";
import { settingsCopy } from "@/lib/copy/settings";
import { emailChangeApplied } from "@/lib/client/save-streak";
import { useBlocks, usePatchProfile, useUnblock, type MeExtra } from "@/lib/client/social";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { hasSupabase } from "@/lib/supabase/env";
import { clearOfflineUserData } from "@/lib/offline/register";
import { TabPage } from "@/components/meta/TabPage";
import { AvatarChip, BackButton, PageTitle, Switch } from "@/components/meta/ui";
import { nicknameProblem } from "@/lib/validation/nickname";
import { Sheet } from "@/components/meta/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const THEME = { dark: "Dark", light: "Light", system: "System" } as const;
const CB = { off: "Off", protan: "Protan", deutan: "Deutan", tritan: "Tritan" } as const;
const TEXT = { 100: "Default", 110: "Large", 120: "Larger", 130: "Largest" } as const;
const SYNCED: (keyof Settings)[] = [
  "sfx",
  "music",
  "haptics",
  "hapticsTouched",
  "theme",
  "cb",
  "reducedMotion",
  "textScale",
  "relaxed",
  "lowData",
];

type SheetId = "theme" | "cb" | "text" | "privacy" | "account" | "delete" | "nickname" | null;

/** K1 Settings. Saved on this device right away (localStorage) and to your account (PATCH /api/v1/profile). */
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}

function SettingsScreen() {
  const s = useSettings();
  const me = useMe();
  const patch = usePatchProfile();
  const params = useSearchParams();
  // Deep links (#account, #privacy, #place) open their sheet; the sheet portal only renders on the client.
  const [open, setOpen] = useState<SheetId>(() => {
    if (typeof window === "undefined") return null;
    const h = window.location.hash.slice(1);
    return h === "account" || h === "privacy" ? h : h === "place" ? "privacy" : null;
  });
  const auth = params.get("auth");
  const [status, setStatus] = useState<string | null>(
    auth === "linked"
      ? "Signed in. Your progress is saved to your account."
      : auth === "failed"
        ? "Sign-in didn't finish. Try again."
        : null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = s.hydrated && prefersReducedMotion(s);

  // Account copy of the settings, debounced, so the same look and sound follow you to a new phone.
  const save = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    s.set(key, value);
    if (!me.data) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const st = useSettings.getState();
      patch.mutate({ settings: Object.fromEntries(SYNCED.map((k) => [k, st[k]])) });
    }, 600);
  };

  const d = me.data;
  return (
    <TabPage label="Settings">
      {/* Settings opens from Me (or the side nav on desktop): Back returns there, or to Me on a fresh tab. */}
      <div className="flex items-center gap-3">
        <BackButton label={settingsCopy.back} fallback="/me" />
        <PageTitle>Settings</PageTitle>
      </div>
      {status && (
        <p role="status" className="bg-surface rounded-[14px] px-3.5 py-2.5 text-[14px] font-medium">
          {status}
        </p>
      )}
      {d && (
        <Group title={settingsCopy.profile}>
          <Row icon="pencil-simple" label={settingsCopy.nickname.row} value={d.nickname} onClick={() => setOpen("nickname")} />
        </Group>
      )}
      <Group title="Look and feel">
        <Row icon="moon" label="Theme" value={THEME[s.theme]} onClick={() => setOpen("theme")} />
        <Row icon="eye" label="Colour-blind mode" value={CB[s.cb]} onClick={() => setOpen("cb")} />
        <Row icon="text-aa" label="Text size" value={TEXT[s.textScale]} onClick={() => setOpen("text")} />
        <Row icon="person-simple-walk" label="Reduced motion">
          <Switch checked={reduce} onChange={(v) => save("reducedMotion", v ? "on" : "off")} label="Reduced motion" />
        </Row>
      </Group>
      <Group title="Sound and feel">
        <Row icon="speaker-high" label="Sound effects">
          <Switch checked={s.sfx} onChange={(v) => save("sfx", v)} label="Sound effects" />
        </Row>
        <Row icon="music-notes" label="Music">
          <Switch checked={s.music && !s.lowData} disabled={s.lowData} onChange={(v) => save("music", v)} label="Music" />
        </Row>
        <Row icon="vibrate" label="Haptics">
          <Switch checked={s.haptics} onChange={(v) => save("haptics", v)} label="Haptics" />
        </Row>
      </Group>
      <Group title="Data and account">
        <Row icon="cell-signal-low" label="Low-data mode" hint="No music, lighter animations">
          <Switch checked={s.lowData} onChange={(v) => save("lowData", v)} label="Low-data mode" />
        </Row>
        <Row icon="timer" label="Relaxed mode" hint="Timers hidden until results">
          <Switch checked={s.relaxed} onChange={(v) => save("relaxed", v)} label="Relaxed mode" />
        </Row>
        <Row
          icon="lock-simple"
          label="Privacy"
          value={(d as (typeof d & MeExtra) | undefined)?.hide_activity ? "Hidden" : "Friends only"}
          onClick={() => setOpen("privacy")}
        />
        <Row
          icon="user-circle"
          label="Account"
          value={d ? (d.guest ? "Guest" : (d.email ?? "Signed in")) : ""}
          onClick={() => setOpen("account")}
        />
      </Group>
      <Group title="Help and legal">
        <LinkRow icon="question" label="How to play" href="/how-to-play" />
        <LinkRow icon="scales" label="Fair play" href="/fair-play" />
        <LinkRow icon="shield-check" label="Privacy policy" href="/privacy" />
        <LinkRow icon="clipboard-text" label="Terms" href="/terms" />
        <LinkRow icon="envelope" label="Contact" href="/contact" />
      </Group>

      <Choice
        open={open === "theme"}
        title="Theme"
        options={Object.entries(THEME)}
        value={s.theme}
        onPick={(v) => save("theme", v as Settings["theme"])}
        onClose={() => setOpen(null)}
      />
      <Choice
        open={open === "cb"}
        title="Colour-blind mode"
        description="Swaps world and state colours and adds patterns, so nothing relies on colour alone."
        options={Object.entries(CB)}
        value={s.cb}
        onPick={(v) => save("cb", v as Settings["cb"])}
        onClose={() => setOpen(null)}
      />
      <Choice
        open={open === "text"}
        title="Text size"
        options={Object.entries(TEXT).map(([k, v]) => [k, `${v}, ${k}%`])}
        value={String(s.textScale)}
        onPick={(v) => save("textScale", Number(v) as Settings["textScale"])}
        onClose={() => setOpen(null)}
      />
      <PrivacySheet open={open === "privacy"} onClose={() => setOpen(null)} />
      <AccountSheet open={open === "account"} onClose={() => setOpen(null)} onDelete={() => setOpen("delete")} />
      <DeleteSheet open={open === "delete"} onClose={() => setOpen(null)} />
      {d && (
        <NicknameSheet
          open={open === "nickname"}
          current={d.nickname}
          onClose={() => setOpen(null)}
          onSaved={(name) => {
            setOpen(null);
            setStatus(settingsCopy.nickname.saved(name));
          }}
        />
      )}
    </TabPage>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-0.5">
      <h2 className="text-muted px-1 py-1.5 text-[14px] font-semibold">{title}</h2>
      <div className="bg-surface divide-line divide-y rounded-[18px] px-3.5">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  hint,
  onClick,
  children,
}: {
  icon: string;
  label: string;
  value?: string;
  hint?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <Icon name={icon} size={20} className="text-muted shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-[16px] font-medium">{label}</span>
        {hint && <span className="text-muted text-[13px]">{hint}</span>}
      </span>
      {children}
      {value !== undefined && (
        <span className="text-muted flex max-w-[45%] items-center gap-1.5 text-[15px] font-medium">
          <span className="truncate">{value}</span>
          <Icon name="caret-right" size={14} className="shrink-0" />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button onClick={onClick} aria-haspopup="dialog" className="flex min-h-[50px] w-full items-center gap-3 py-1.5">
      {inner}
    </button>
  ) : (
    <div className="flex min-h-[50px] items-center gap-3 py-1.5">{inner}</div>
  );
}

function LinkRow({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Link href={href} className="flex min-h-[50px] items-center gap-3 py-1.5">
      <Icon name={icon} size={20} className="text-muted shrink-0" />
      <span className="flex-1 text-[16px] font-medium">{label}</span>
      <Icon name="caret-right" size={14} className="text-muted" />
    </Link>
  );
}

function Choice({
  open,
  title,
  description,
  options,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  options: [string, string][];
  value: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title} description={description}>
      <div role="radiogroup" aria-label={title} className="flex flex-col gap-2">
        {options.map(([k, label]) => {
          const on = k === value;
          return (
            <button
              key={k}
              role="radio"
              aria-checked={on}
              onClick={() => onPick(k)}
              className="flex h-[52px] items-center justify-between rounded-[14px] px-3.5 text-[15px] font-semibold"
              style={{
                background: on ? "var(--success-tint)" : "var(--surface-raised)",
                boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined,
              }}
            >
              {label}
              {on && <Icon name="check" size={18} className="text-accent" />}
            </button>
          );
        })}
      </div>
      <Button variant="secondary" className="mt-1 w-full" onClick={onClose}>
        Done
      </Button>
    </Sheet>
  );
}

function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const patch = usePatchProfile();
  const blocks = useBlocks();
  const unblock = useUnblock();
  const d = me.data as (NonNullable<ReturnType<typeof useMe>["data"]> & MeExtra) | null | undefined;
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Privacy"
      description="No chat, ever. Friends only see presets and results."
    >
      <div className="flex items-center justify-between gap-3 py-1">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Hide my activity</span>
          <span className="text-muted text-[13px]">Friends won&apos;t see your clears, presence or streaks in their feed.</span>
        </span>
        <Switch checked={!!d?.hide_activity} onChange={(v) => patch.mutate({ hideActivity: v })} label="Hide my activity" />
      </div>
      {d && <PlaceForm initialCountry={d.country ?? ""} initialCity={d.city ?? ""} minor={d.age_band === "13-15"} />}
      <div className="flex flex-col gap-2 pt-2">
        <span className="text-[15px] font-semibold">Blocked</span>
        {blocks.data?.blocked.length ? (
          blocks.data.blocked.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5">
              <AvatarChip nickname={b.nickname} color={b.color} size={32} radius={10} />
              <span className="flex-1 text-[15px] font-semibold">{b.nickname}</span>
              <button
                onClick={() => unblock.mutate(b.id)}
                className="press bg-surface-raised h-11 rounded-[12px] px-3 text-[14px] font-semibold"
              >
                Unblock
              </button>
            </div>
          ))
        ) : (
          <span className="text-muted text-[14px]">Nobody. Block from any profile or the activity feed.</span>
        )}
      </div>
    </Sheet>
  );
}

function AccountSheet({ open, onClose, onDelete }: { open: boolean; onClose: () => void; onDelete: () => void }) {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"link" | "signin">("link");
  /** where the magic link went, or `applied` when the email change took effect at once (no email sent) */
  const [sent, setSent] = useState<{ to: string; applied: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = me.data;
  const redirect = () => `${window.location.origin}/auth/callback?next=/settings`;

  const google = async () => {
    setErr(null);
    if (!hasSupabase()) return;
    const sb = supabaseBrowser();
    // Linking keeps the same user id, so the guest's progress stays (FR-AC-04).
    const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo: redirect() } });
    if (error) setErr("Google sign-in isn't available right now. Try email.");
  };
  const byEmail = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const sb = supabaseBrowser();
    // Saving a guest: attach the email to this same account (the confirmation link keeps all progress).
    const to = email.trim();
    const { data, error } = await sb.auth.updateUser({ email: to }, { emailRedirectTo: redirect() });
    if (error) {
      setBusy(false);
      setErr(
        /already/i.test(error.message)
          ? "That email has an account. Use “Sign in instead” below."
          : "That didn't send. Check the address and try again.",
      );
      return;
    }
    // Projects without email confirmation apply the change at once and send nothing: the user already has
    // the new email. Refresh the session (no longer anonymous) and mark the player as saved.
    const applied = emailChangeApplied(data.user, to);
    if (applied) {
      await sb.auth.refreshSession().catch(() => null);
      await api("/api/v1/account/sync", { method: "POST" }).catch(() => {});
      void qc.invalidateQueries({ queryKey: ["me"] });
    }
    setBusy(false);
    setSent({ to, applied });
  };
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    await clearOfflineUserData();
    qc.clear();
    router.replace("/intro");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Account"
      description={
        d?.guest
          ? "You're playing as a guest. Sign in to keep your streak, Sparks and friends on any phone."
          : d
            ? `Signed in as ${d.nickname}${d.email ? ` (${d.email})` : ""}.`
            : "Signed in."
      }
    >
      {sent?.applied && (
        <p role="status" className="bg-surface-raised rounded-[14px] px-3.5 py-3 text-[15px]">
          {settingsCopy.account.linkApplied(sent.to)}
        </p>
      )}
      {d?.guest && (
        <>
          <Button size="lg" variant="secondary" className="w-full" icon="globe" onClick={google}>
            Continue with Google
          </Button>
          {sent ? (
            sent.applied ? null : (
              <p role="status" className="bg-surface-raised rounded-[14px] px-3.5 py-3 text-[15px]">
                {settingsCopy.account.linkSent(sent.to)}
              </p>
            )
          ) : mode === "signin" ? (
            <div className="flex flex-col gap-2">
              <p className="text-[15px] font-semibold">{copy.account.signInExisting}</p>
              <p className="text-gold text-[13px]">{copy.account.signInLeavesGuest}</p>
              <EmailCodeSignIn
                autoFocus={false}
                onDone={(hasProfile) => {
                  qc.clear();
                  router.replace(hasProfile ? "/" : "/welcome");
                }}
              />
              <button type="button" onClick={() => setMode("link")} className="text-accent h-11 text-[14px] font-semibold">
                {copy.account.backToSaving}
              </button>
            </div>
          ) : (
            <form onSubmit={byEmail} className="flex flex-col gap-2">
              <label htmlFor="acct-email" className="text-[15px] font-semibold">
                Or get a magic link by email
              </label>
              <input
                id="acct-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-surface-raised h-12 rounded-[14px] px-3.5 text-[16px] outline-none"
              />
              <Button type="submit" loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email)}>
                Send magic link
              </Button>
              <button type="button" onClick={() => setMode("signin")} className="text-accent h-11 text-[14px] font-semibold">
                Already have an account? Sign in instead
              </button>
            </form>
          )}
          {err && (
            <p role="alert" className="text-danger text-[14px]">
              {err}
            </p>
          )}
        </>
      )}
      <div className="flex flex-col gap-2 pt-1">
        <a
          href="/api/v1/account/export"
          download
          className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
        >
          <Icon name="download-simple" size={20} />
          Download my data
        </a>
        {!d?.guest && (
          <button
            onClick={signOut}
            className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
          >
            <Icon name="sign-out" size={20} />
            Sign out
          </button>
        )}
        <button
          onClick={onDelete}
          className="press flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold"
          style={{ background: "var(--danger-tint)", color: "var(--danger)" }}
        >
          <Icon name="trash" size={20} />
          Delete account
        </button>
      </div>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nick = me.data?.nickname ?? "";
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/v1/account", { method: "DELETE", json: { confirm } });
      await supabaseBrowser().auth.signOut();
      await clearOfflineUserData();
      try {
        localStorage.removeItem("spuzl.onboarding");
      } catch {
        /* storage blocked */
      }
      qc.clear();
      router.replace("/intro");
    } catch (e) {
      setErr(e instanceof HttpError && e.message !== e.code ? e.message : "That didn't go through. Nothing was deleted.");
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Delete your account?"
      description="This removes your profile, streak, Sparks, badges, friends and every result. It can't be undone."
    >
      <label htmlFor="del-confirm" className="text-[15px] font-semibold">
        Type <span className="num text-danger">{nick}</span> to confirm
      </label>
      <input
        id="del-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        className="bg-surface-raised h-12 rounded-[14px] px-3.5 text-[16px] outline-none"
      />
      {err && (
        <p role="alert" className="text-danger text-[14px]">
          {err}
        </p>
      )}
      <Button
        size="lg"
        variant="danger"
        className="w-full"
        disabled={confirm.toLowerCase() !== nick.toLowerCase() || !nick}
        loading={busy}
        onClick={go}
      >
        Delete forever
      </Button>
      <Button variant="ghost" className="w-full" onClick={onClose}>
        Keep my account
      </Button>
    </Sheet>
  );
}

function PlaceForm({ initialCountry, initialCity, minor }: { initialCountry: string; initialCity: string; minor: boolean }) {
  const patch = usePatchProfile();
  const [country, setCountry] = useState(initialCountry);
  const [city, setCity] = useState(initialCity);
  const [saved, setSaved] = useState(false);
  const savePlace = async (e: FormEvent) => {
    e.preventDefault();
    await patch.mutateAsync({ country: country ? country.toUpperCase() : null, city: city.trim() || null });
    setSaved(true);
  };
  return (
    <form id="place" onSubmit={savePlace} className="flex flex-col gap-2 pt-1">
      <span className="text-[15px] font-semibold">Your place, for local boards</span>
      {minor && <span className="text-muted text-[13px]">Under 16, your city never shows on public boards.</span>}
      <div className="flex gap-2">
        <label className="flex w-24 flex-col gap-1">
          <span className="text-muted text-[13px]">Country</span>
          <input
            value={country}
            onChange={(e) =>
              setCountry(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 2),
              )
            }
            placeholder="GH"
            className="bg-surface-raised h-11 rounded-[12px] px-3 text-[16px] font-semibold uppercase outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-muted text-[13px]">City</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value.replace(/[^\p{L} '.]/gu, "").slice(0, 40))}
            placeholder="Accra"
            className="bg-surface-raised h-11 rounded-[12px] px-3 text-[16px] font-medium outline-none"
          />
        </label>
      </div>
      <Button type="submit" variant="secondary" loading={patch.isPending} disabled={country.length === 1}>
        {saved ? "Saved" : "Save place"}
      </Button>
    </form>
  );
}

/** Change the nickname: checked here as you type (same rules as the server), then saved with PATCH /profile. */
function NicknameSheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const T = settingsCopy.nickname;
  const qc = useQueryClient();
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(current);
      setError(null);
    }
  }
  const trimmed = name.trim();
  const problem = trimmed && trimmed !== current ? nicknameProblem(trimmed) : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || problem) return;
    if (trimmed === current) return setError(T.same);
    setSaving(true);
    setError(null);
    try {
      await api("/api/v1/profile", { method: "PATCH", json: { nickname: trimmed } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      onSaved(trimmed);
    } catch (err) {
      setError(
        err instanceof HttpError && err.code === "nickname_taken"
          ? T.taken
          : err instanceof HttpError && err.status === 422
            ? err.message
            : T.failed,
      );
    } finally {
      setSaving(false);
    }
  };
  const shown = error ?? problem;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={T.title} description={T.description}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="nick-edit" className="text-[15px] font-semibold">
          {T.label}
        </label>
        <input
          id="nick-edit"
          value={name}
          onChange={(e) => {
            setName(e.target.value.replace(/\s/g, "").slice(0, 16));
            setError(null);
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={16}
          aria-invalid={!!shown}
          aria-describedby="nick-edit-help"
          className="bg-surface-raised h-14 rounded-[16px] px-4 text-[18px] font-semibold outline-none"
          style={{ boxShadow: `inset 0 0 0 2px ${shown ? "var(--danger)" : "var(--line)"}` }}
        />
        <p
          id="nick-edit-help"
          role={shown ? "alert" : undefined}
          className="text-[14px]"
          style={{ color: shown ? "var(--danger)" : "var(--text-muted)" }}
        >
          {shown ?? T.help}
        </p>
        <Button size="lg" type="submit" disabled={!trimmed || !!problem || saving} loading={saving}>
          {saving ? T.saving : T.save}
        </Button>
      </form>
    </Sheet>
  );
}
