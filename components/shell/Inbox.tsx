"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { useMe } from "@/lib/client/api";
import { useChannel } from "@/lib/client/multiplayer";
import { alertIfAway, enablePush } from "@/lib/client/alerts";
import { GAME_BY_ID } from "@/lib/catalog";
import { play } from "@/lib/audio";
import { noteAlertsTrigger } from "@/lib/prompts/alerts";
import { useQuiet } from "@/lib/perf/quiet";
import { AlertsAsk } from "./AlertsAsk";
import { SpuzChip } from "@/components/meta/SpuzChip";

/** What arrives on a player's own channel (user:<id>) from the server. */
interface TurnMsg {
  matchId: string;
  game: string;
}
export interface InviteMsg {
  id: string;
  /** R3-16: the inviter's look (skin colour and Shop hat) for the card's Spuz */
  from: { nickname: string; color: string; hat?: string | null };
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
  /** a friend's invite: their Spuz (in their look) stands on the card, the kind's icon as a badge */
  who?: { color: string; hat: string | null };
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
  // R3-03: the live inbox connection (and the push refresh) waits until the screen is quiet (Home and other screens:
  // a few seconds after load; Play: after the board is up), so neither competes with the first paint on a phone.
  const quiet = useQuiet();
  const id = quiet ? (me.data?.id ?? null) : null;
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
          color: "var(--accent)",
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
          color: "var(--accent)",
          icon: "bell-ringing",
          ms: 15_000,
        });
      }),
      channel.onMessage("invite", (p) => {
        const v = p as InviteMsg;
        if (v.kind === "duel" || v.kind === "party") noteAlertsTrigger("invite"); // earns the notification ask
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
          who: { color: v.from.color, hat: v.from.hat ?? null },
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
      <AlertsAsk me={me.data ?? null} pathname={pathname} />
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
            {card.who ? (
              <SpuzChip color={card.who.color} hat={card.who.hat} size={44} radius={14}>
                <span
                  className="bg-accent text-on-accent absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full"
                  style={{ boxShadow: "0 0 0 2px var(--surface-raised)" }}
                >
                  <Icon name={card.icon} size={14} />
                </span>
              </SpuzChip>
            ) : (
              <span
                className="flex size-11 flex-none items-center justify-center rounded-[14px]"
                style={{ background: card.color, color: "#0E0F1A" }}
              >
                <Icon name={card.icon} size={22} />
              </span>
            )}
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
