"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Banner, BannerStack } from "@/components/notify/Banner";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { Confetti } from "@/components/fx/Confetti";
import { ShareSheet } from "@/components/share/ShareSheet";
import { api, ensureSession } from "@/lib/client/api";
import { finishOrQueue, onSynced, usePendingCount } from "@/lib/offline/queue";
import { buildNotices } from "@/lib/notify/notices";
import { dailyShareText } from "@/lib/share/text";
import { useSettings } from "@/lib/settings/store";

/** Crownfall tutorial (4 × 4, solution [1, 3, 0, 2]) as a solved board: 2 = crown. */
const SOLVED = [0, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 0];

const SAMPLE_NOTICES = buildNotices(
  {
    streak: { current: 12, last_clear_date: "2026-10-30" },
    date: "2026-10-31",
    readyGames: ["crownfall", "pinned", "buried"],
    seenGames: ["crownfall"],
    league: { week: "2026-10-26", outcome: "promoted", tier: "Silver", place: 5, of: 30 },
  },
  new Date("2026-10-31T21:00:00"),
);

export function PwaFixture() {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const pending = usePendingCount();
  const lowData = useSettings((s) => s.lowData);
  const setSetting = useSettings((s) => s.set);
  const add = (line: string) => setLog((l) => [...l, line]);

  useEffect(
    () =>
      onSynced((s) => {
        const status = (s.result as { status?: string } | null)?.status ?? "closed";
        add(`Synced ${s.attemptId.slice(0, 8)}: ${status}`);
      }),
    [],
  );

  async function setup() {
    try {
      await ensureSession();
      await api("/api/v1/profile", {
        json: { nickname: `pwa_${Math.random().toString(36).slice(2, 8)}`, ageBand: "18+", color: "#2FD3E0" },
      });
      const r = await api<{ attemptId: string }>("/api/v1/attempts", { json: { game: "crownfall", mode: "tutorial" } });
      setAttemptId(r.attemptId);
      add(`Ready ${r.attemptId.slice(0, 8)}`);
    } catch (e) {
      add(`Setup failed: ${(e as Error).message}`);
    }
  }

  async function clear() {
    if (!attemptId) return;
    try {
      const r = await finishOrQueue<{ status: string }>(attemptId, { state: SOLVED, activeMs: 12_000, mistakes: 0 });
      add(r.queued ? "Saved on this device. Syncs when you're back." : `Cleared online: ${r.result.status}`);
    } catch (e) {
      add(`Finish failed: ${(e as Error).message}`);
    }
  }

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-4 p-4">
      <h1 className="font-display text-[24px] font-black">PWA layer</h1>
      <OfflineBanner />
      <OfflineBanner context="home" />

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[17px] font-extrabold">Offline clear</h2>
        <div className="flex gap-2">
          <Button onClick={setup} data-testid="setup">
            Set up
          </Button>
          <Button variant="secondary" onClick={clear} disabled={!attemptId} data-testid="clear">
            Clear
          </Button>
        </div>
        <p className="num text-muted text-[14px]" data-testid="pending">
          Waiting to sync: {pending}
        </p>
        <ul className="text-[14px]" data-testid="log" aria-live="polite">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[17px] font-extrabold">Notices</h2>
        <BannerStack items={SAMPLE_NOTICES.map((n) => ({ ...n, onAction: () => undefined, onDismiss: () => undefined }))} />
        <Banner icon="wifi-slash" tone="warn" compact text="Offline. Keep solving, we'll sync your time." />
      </section>

      <section className="flex flex-wrap gap-2">
        <Button icon="share-fat" onClick={() => setShareOpen(true)} data-testid="open-share">
          Share
        </Button>
        <Button variant="secondary" icon="confetti" onClick={() => setConfetti((n) => n + 1)}>
          Confetti
        </Button>
        <Button variant="ghost" onClick={() => setSetting("lowData", !lowData)}>
          Low data: {lowData ? "On" : "Off"}
        </Button>
      </section>

      {confetti > 0 && <Confetti seed={`fixture-${confetti}`} />}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        text={dailyShareText({ gameId: "crownfall", number: 214, timeMs: 72_000, hintsAtMs: [52_000], streak: 12 })}
        image="/api/og/sample/daily"
        fileName="spuzl-crownfall-214.png"
      />
    </main>
  );
}
