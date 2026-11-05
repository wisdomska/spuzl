"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/lib/client/api";
import { useChannel } from "@/lib/client/multiplayer";
import { alertIfAway, alertsSupported, askAlerts, enablePush } from "@/lib/client/alerts";
import { GAME_BY_ID } from "@/lib/catalog";
import { play } from "@/lib/audio";

/** What arrives on a player's own channel (user:<id>) from the server. */
interface TurnMsg {
  matchId: string;
  game: string;
}
export interface InviteMsg {
  id: string;
  from: { nickname: string; color: string };
  kind: "duel" | "party" | "bay";
  game: string | null;
  href: string;
}

interface Card {
  key: string;
  title: string;
  body: string;
  action: string;
  href: string;
  color: string;
  icon: string;
  ms: number;
}

const gameName = (g: string | null) => (g ? (GAME_BY_ID[g]?.name ?? "a game") : "a game");

/**
 * The app-wide inbox: whatever page you are on, it hears your turn coming round in a board game, a nudge, and a
 * friend's invite, and puts up a card with a button to go there (with a sound and a buzz). In a background tab it
 * flashes the title and, when allowed, sends a system notification. The match you are already looking at handles
 * its own turn alert, so no card for that.
 */
export function Inbox() {
  const me = useMe();
  const id = me.data?.id ?? null;
  const { channel } = useChannel(id ? `user:${id}` : null);
  const pathname = usePathname();
  const where = useRef(pathname);
  useEffect(() => {
    where.current = pathname;
  }, [pathname]);
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  // Alerts already allowed on this device: make sure its push subscription is saved for this player (a new
  // sign-in, a renewed subscription). Quiet; does nothing without permission.
  useEffect(() => {
    if (id) void enablePush();
  }, [id]);

  useEffect(() => {
    if (!channel) return;
    const show = (c: Card) => {
      setCard(c);
      play("notify"); // with its buzz (lib/haptics HAPTICS)
      alertIfAway(c.title, c.body, c.href, c.key);
    };
    const offs = [
      channel.onMessage("your_turn", (p) => {
        const t = p as TurnMsg;
        if (where.current === `/bay/${t.matchId}`) return;
        show({
          key: `turn:${t.matchId}`,
          title: "Your turn",
          body: `It's your move in ${gameName(t.game)}.`,
          action: "Play",
          href: `/bay/${t.matchId}`,
          color: "var(--w-board)",
          icon: "hand-pointing",
          ms: 15_000,
        });
      }),
      channel.onMessage("nudge", (p) => {
        const t = p as TurnMsg;
        if (where.current === `/bay/${t.matchId}`) return;
        show({
          key: `nudge:${t.matchId}`,
          title: "Nudge",
          body: `Your rival is waiting on your move in ${gameName(t.game)}.`,
          action: "Play",
          href: `/bay/${t.matchId}`,
          color: "var(--w-board)",
          icon: "bell-ringing",
          ms: 15_000,
        });
      }),
      channel.onMessage("invite", (p) => {
        const v = p as InviteMsg;
        const what = v.kind === "duel" ? "a Duel" : v.kind === "party" ? "a Party Race" : `a game of ${gameName(v.game)}`;
        show({
          key: `invite:${v.id}`,
          title: `${v.from.nickname} invited you`,
          body: v.kind === "duel" && v.game ? `${what} in ${gameName(v.game)}. Join now?` : `${what}. Join now?`,
          action: "Join",
          href: v.href,
          color: v.from.color,
          icon: v.kind === "duel" ? "sword" : v.kind === "party" ? "users-three" : "horse",
          ms: 45_000,
        });
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [channel]);

  // Cards go by themselves after a while.
  useEffect(() => {
    if (!card) return;
    const t = setTimeout(() => setCard((c) => (c?.key === card.key ? null : c)), card.ms);
    return () => clearTimeout(t);
  }, [card]);

  return (
    <>
      <AlertsAsk signedIn={!!id} pathname={pathname} />
      <AnimatePresence>
        {card && (
          <motion.div
            key={card.key}
            role="alert"
            className="bg-surface-raised fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[70] mx-auto flex max-w-[480px] items-center gap-3 rounded-[20px] p-3 shadow-[0_14px_40px_rgba(0,0,0,.45)]"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <span
              className="flex size-11 flex-none items-center justify-center rounded-[14px]"
              style={{ background: card.color, color: "#0E0F1A" }}
            >
              <Icon name={card.icon} size={22} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-display truncate text-[16px] font-black">{card.title}</span>
              <span className="text-muted truncate text-[14px]">{card.body}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setCard(null);
                router.push(card.href);
              }}
              className="press bg-accent text-on-accent font-display h-11 flex-none rounded-[14px] px-4 text-[15px] font-black"
            >
              {card.action}
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setCard(null)}
              className="press text-muted flex size-9 flex-none items-center justify-center"
            >
              <Icon name="x" size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const ASKED = "spuzl.alertsAsked";
/** Screens where the ask would get in the way of play or sign-in: a game in progress, the intro, welcome, admin. */
const QUIET = /^\/(play|intro|welcome|admin)(\/|$)/;
/** "Not now" asks again after 3 days, at most 3 times in all. */
const AGAIN_MS = 3 * 24 * 3600_000;
const MAX_ASKS = 3;

function askedState(): { n: number; at: number } {
  try {
    const raw = localStorage.getItem(ASKED);
    if (!raw) return { n: 0, at: 0 };
    if (raw === "1") return { n: 1, at: 0 }; // the old one-time flag counts as one ask
    const v = JSON.parse(raw) as { n?: number; at?: number };
    return { n: v.n ?? 1, at: v.at ?? 0 };
  } catch {
    return { n: MAX_ASKS, at: Date.now() };
  }
}

/** Whether it is time to ask (never asked, or Not now a few days ago and asks left). */
function askDue(): boolean {
  const st = askedState();
  return st.n < MAX_ASKS && Date.now() - st.at >= AGAIN_MS;
}

/**
 * Alerts are on by default: a browser only allows notifications after the player says yes once, so once they are
 * signed in we ask, in our own words, on the first screen that isn't a game in progress. Yes turns on push for this
 * device; Not now asks again a few days later (three asks in all). Settings can turn it on any time.
 */
function AlertsAsk({ signedIn, pathname }: { signedIn: boolean; pathname: string }) {
  const [asked, setAsked] = useState(true);
  // checked again when the page changes and once the player has loaded (signed in arrives after the first render)
  const [seen, setSeen] = useState("");
  const key = `${pathname}|${signedIn}`;
  if (seen !== key) {
    setSeen(key);
    const due = askDue();
    const want = signedIn && !QUIET.test(pathname) && alertsSupported() && Notification.permission === "default" && due;
    if (want !== !asked) setAsked(!want);
  }
  const close = () => {
    try {
      localStorage.setItem(ASKED, JSON.stringify({ n: askedState().n + 1, at: Date.now() }));
    } catch {
      /* private mode: may ask again next time */
    }
    setAsked(true);
  };
  return (
    <AnimatePresence>
      {!asked && (
        <motion.div
          role="dialog"
          aria-label="Turn on alerts"
          className="bg-surface-raised fixed inset-x-3 bottom-[max(16px,env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-[480px] flex-col gap-3 rounded-[20px] p-4 shadow-[0_14px_40px_rgba(0,0,0,.45)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex items-center gap-3">
            <span className="bg-accent text-on-accent flex size-11 flex-none items-center justify-center rounded-[14px]">
              <Icon name="bell-ringing" size={22} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-[16px] font-black">Know when it&apos;s your turn</span>
              <span className="text-muted text-[14px]">
                Alerts for your turn, nudges and friends&apos; invites, even with SPUZL closed.
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={close} className="press bg-surface h-11 rounded-[14px] text-[15px] font-semibold">
              Not now
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                void askAlerts();
              }}
              className="press bg-accent text-on-accent font-display h-11 rounded-[14px] text-[15px] font-black"
            >
              Turn on
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
