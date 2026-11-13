"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ShareSheet } from "@/components/share/ShareSheet";
import type { InboxGame } from "@/components/board/YourMoveInbox";
import { api } from "@/lib/client/api";
import { useFriends } from "@/lib/client/social";
import { playerGames } from "@/lib/catalog";
import { useGamesMeta } from "@/lib/games-meta/client";
import { newGameIds } from "@/lib/games-meta";
import { useGameSettings } from "@/lib/game-settings/client";
import { track } from "@/lib/analytics/track";
import { hasRecap, recapWeeks, weekLabels, type WeeklyRecap } from "@/lib/recap/weekly";
import type { RecapStat } from "@/lib/share/recap-card";
import { buildInbox, unseenCount, type InboxItem } from "@/lib/notify/inbox";
import { inboxCopy as T } from "@/lib/copy/inbox";
import { weeklyRecapCopy as W } from "@/lib/copy/weekly-recap";

interface RecapRes {
  thisWeek: string;
  week: string;
  recap: WeeklyRecap | null;
  stats: RecapStat[];
  card: { image: string; width: number; height: number; text: string; alt: string } | null;
}

const REMOVED_KEY = "spuzl.inbox.removed";
const SEEN_KEY = "spuzl.inbox.seen";
const PROMPT = { prompt: "weekly_recap", trigger: "week" } as const;
const STAT_ICON: Record<RecapStat["id"], string> = { best: "timer", streak: "fire", league: "trophy", sparks: "sparkle" };

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-100)));
  } catch {
    /* private mode: items may show as new again next visit */
  }
}

/**
 * The bell on Home (owner, 13 Nov 2026): one place for the weekly roundup, new games, friend requests and Board
 * Games waiting on your move, so nothing on Home covers the screen. A dot with a number counts what this device
 * hasn't seen; opening the list marks everything seen. The roundup and new games can be removed (×); friend
 * requests and moves leave once answered. Reads only what Home would show anyway, with modest refresh rates.
 */
export function NotificationBell({ played }: { played: readonly string[] }) {
  const router = useRouter();
  const settings = useGameSettings();
  const meta = useGamesMeta();
  const [open, setOpen] = useState(false);
  const [week, setWeek] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [thisWeek, setThisWeek] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock and localStorage are client-only
    setRemoved(readList(REMOVED_KEY));
    setSeen(readList(SEEN_KEY));
    setThisWeek(recapWeeks(new Date()).thisWeek);
  }, []);

  const recapOn = settings["weeklyRecap.enabled"] && !!thisWeek;
  const recap = useQuery({
    queryKey: ["weekly-recap", thisWeek],
    queryFn: () => api<RecapRes>("/api/v1/me/weekly-recap"),
    enabled: recapOn,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const friends = useFriends();
  const bay = useQuery({
    queryKey: ["bay-inbox"],
    queryFn: () => api<{ games: InboxGame[] }>("/api/v1/bay"),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });

  const newIds = useMemo(() => newGameIds(playerGames(settings), meta), [meta, settings]);
  const r = recap.data;
  const items = useMemo(
    () =>
      buildInbox({
        week: recapOn && r && hasRecap(r.recap) ? { id: r.week, cleared: r.recap.cleared } : null,
        newGames: newIds.length
          ? { key: [...newIds].sort().join(","), unplayed: newIds.filter((id) => !played.includes(id)).length }
          : null,
        friendRequests: { names: (friends.data?.incoming ?? []).map((f) => f.nickname) },
        yourMove: (bay.data?.games ?? [])
          .filter((g) => g.status === "your-move")
          .map((g) => ({ id: g.id, opponent: g.opponent.name, detail: g.detail })),
        removed,
      }),
    [recapOn, r, newIds, played, friends.data, bay.data, removed],
  );
  const fresh = unseenCount(items, seen);

  const show = (v: boolean) => {
    setOpen(v);
    if (v && fresh) {
      const next = [...new Set([...seen, ...items.map((i) => i.id)])];
      setSeen(next);
      writeList(SEEN_KEY, next);
    }
  };
  const remove = (id: string) => {
    const next = [...new Set([...removed, id])];
    setRemoved(next);
    writeList(REMOVED_KEY, next);
  };
  const choose = (i: InboxItem) => {
    if (i.kind === "week") {
      track("prompt_shown", PROMPT);
      setOpen(false);
      setWeek(true);
      return;
    }
    setOpen(false);
    if (i.href) router.push(i.href);
  };

  const range = r ? weekLabels(r.week) : null;
  const playHref = settings["dailyFive.enabled"] ? "/daily" : "/library";
  return (
    <>
      <button
        type="button"
        onClick={() => show(true)}
        aria-label={T.open(fresh)}
        data-bell
        className="press bg-surface-raised relative flex size-10 items-center justify-center rounded-[14px]"
      >
        <Icon name={fresh ? "bell-ringing" : "bell"} size={20} />
        {fresh > 0 && (
          <span
            aria-hidden
            className="bg-accent text-on-accent num absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold"
          >
            {fresh > 9 ? "9+" : fresh}
          </span>
        )}
      </button>

      <Modal open={open} onOpenChange={show} title={T.title}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Icon name="bell" size={28} className="text-muted" />
            <p className="text-[16px] font-semibold">{T.empty}</p>
            <p className="text-muted text-[14px] text-pretty">{T.emptyHint}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-inbox>
            {items.map((i) => (
              <li key={i.id} className="bg-surface-raised flex min-h-14 items-center gap-1 rounded-[16px] py-1 pr-1 pl-1">
                <button
                  type="button"
                  onClick={() => choose(i)}
                  className="press flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[12px] py-1.5 pl-2.5 text-left"
                >
                  <Icon name={i.icon} size={20} className="text-accent shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] leading-snug font-semibold">{i.title}</span>
                    {i.detail && <span className="text-muted text-[13px] leading-snug">{i.detail}</span>}
                  </span>
                  <Icon name="caret-right" size={14} className="text-muted shrink-0" />
                </button>
                {i.removable && (
                  <button
                    type="button"
                    aria-label={`${T.dismiss}: ${i.title}`}
                    onClick={() => remove(i.id)}
                    className="press text-muted flex size-11 shrink-0 items-center justify-center rounded-[12px]"
                  >
                    <Icon name="x" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {r?.recap && (
        <Modal open={week} onOpenChange={setWeek} title={W.title} description={range ? W.range(range.from, range.to) : undefined}>
          <div className="flex flex-col gap-3" data-testid="weekly-recap">
            <p className="font-display text-[24px] leading-tight font-black">
              <span className="num text-accent">{r.recap.cleared}</span> {W.bigLine(r.recap.cleared)}
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {r.stats.map((s) => (
                <li
                  key={s.id}
                  className={`bg-surface flex flex-col gap-0.5 rounded-[14px] px-3 py-2 ${s.id === "best" ? "col-span-2" : ""}`}
                >
                  <span className="text-muted flex items-center gap-1.5 text-[13px] font-medium">
                    <Icon name={STAT_ICON[s.id]} size={14} />
                    {s.label}
                  </span>
                  <span className="num text-[15px] font-semibold">{s.value.replace("🔥 ", "")}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              {r.card && (
                <Button
                  variant="secondary"
                  icon="share-fat"
                  onClick={() => {
                    setWeek(false);
                    setSharing(true);
                  }}
                >
                  {W.share}
                </Button>
              )}
              <Link
                href={playHref}
                onClick={() => track("prompt_accepted", PROMPT)}
                className={`press bg-accent text-on-accent font-display flex h-12 items-center justify-center rounded-[16px] px-4 text-center text-[15px] leading-tight font-extrabold ${r.card ? "" : "col-span-2"}`}
              >
                {settings["dailyFive.enabled"] ? W.play : W.playAll}
              </Link>
            </div>
          </div>
        </Modal>
      )}
      {r?.card && (
        <ShareSheet
          open={sharing}
          onOpenChange={setSharing}
          kind="recap"
          title={W.sheetTitle}
          text={r.card.text}
          image={r.card.image}
          fileName="spuzl-my-week.png"
          preview={{ width: 108, height: 192, alt: W.previewAlt }}
        />
      )}
    </>
  );
}
